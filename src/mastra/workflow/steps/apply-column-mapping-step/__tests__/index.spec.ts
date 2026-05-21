import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { applyColumnMappingStep } from "../";

type StepOutput = { outputFilePath?: string };

const SAMPLES_DIR = join(import.meta.dir, "../../../../../../samples");

function runStep(inputData: {
  aborted: boolean;
  filePath: string;
  approvedMappings: Array<{
    templateColumn: { title: string; required: boolean };
    csvHeader?: string;
    confidence: number;
  }>;
}): Promise<StepOutput> {
  return applyColumnMappingStep.execute({
    inputData,
    bail: (r: unknown) => r,
  } as any) as Promise<StepOutput>;
}

describe("applyColumnMappingStep", () => {
  describe("aborted workflow", () => {
    it("returns undefined outputFilePath without writing a file", async () => {
      const result = await runStep({
        aborted: true,
        filePath: join(SAMPLES_DIR, "well-formed.csv"),
        approvedMappings: [],
      });

      expect(result.outputFilePath).toBeUndefined();
    });
  });

  describe("output file creation", () => {
    const tmpInput = join(SAMPLES_DIR, "tmp-map-basic.csv");
    let outputFilePath: string | undefined;

    beforeAll(async () => {
      await writeFile(
        tmpInput,
        "sku,name,price\nWGT-001,Widget A,9.99\nWGT-002,Widget B,14.99",
        "utf-8",
      );

      const result = await runStep({
        aborted: false,
        filePath: tmpInput,
        approvedMappings: [
          {
            templateColumn: { title: "Product Name", required: true },
            csvHeader: "name",
            confidence: 1,
          },
          {
            templateColumn: { title: "Price", required: true },
            csvHeader: "price",
            confidence: 1,
          },
          {
            templateColumn: { title: "SKU", required: true },
            csvHeader: "sku",
            confidence: 1,
          },
        ],
      });
      outputFilePath = result.outputFilePath;
    });

    afterAll(async () => {
      await rm(tmpInput, { force: true });

      if (outputFilePath) {
        await rm(outputFilePath, { force: true });
      }
    });

    it("returns the path to the written file", () => {
      expect(outputFilePath).toBeString();
      expect(outputFilePath).toContain("tmp-map-basic-mapped.csv");
    });

    it("creates the output file on disk", async () => {
      const content = await readFile(outputFilePath!, "utf-8");

      expect(content).toBeTruthy();
    });

    it("renames CSV headers to template column titles", async () => {
      const content = await readFile(outputFilePath!, "utf-8");
      const headerLine = content.split("\n")[0];

      expect(headerLine).toContain("Product Name");
      expect(headerLine).toContain("Price");
      expect(headerLine).toContain("SKU");
    });

    it("does not include original CSV header names in output", async () => {
      const content = await readFile(outputFilePath!, "utf-8");
      const headerLine = content.split("\n")[0];

      expect(headerLine).not.toContain("name");
      expect(headerLine).not.toContain("price");
      expect(headerLine).not.toContain("sku");
    });

    it("preserves all data rows", async () => {
      const content = await readFile(outputFilePath!, "utf-8");
      const lines = content.trim().split("\n");

      expect(lines).toHaveLength(3);
    });
  });

  describe("column ordering", () => {
    const tmpInput = join(SAMPLES_DIR, "tmp-map-order.csv");
    let outputFilePath: string | undefined;

    beforeAll(async () => {
      await writeFile(
        tmpInput,
        "sku,name,price\nWGT-001,Widget A,9.99",
        "utf-8",
      );

      const result = await runStep({
        aborted: false,
        filePath: tmpInput,
        approvedMappings: [
          {
            templateColumn: { title: "Price", required: true },
            csvHeader: "price",
            confidence: 1,
          },
          {
            templateColumn: { title: "SKU", required: true },
            csvHeader: "sku",
            confidence: 1,
          },
          {
            templateColumn: { title: "Product Name", required: true },
            csvHeader: "name",
            confidence: 1,
          },
        ],
      });
      outputFilePath = result.outputFilePath;
    });

    afterAll(async () => {
      await rm(tmpInput, { force: true });

      if (outputFilePath) {
        await rm(outputFilePath, { force: true });
      }
    });

    it("writes columns in mapping order, not original CSV order", async () => {
      const content = await readFile(outputFilePath!, "utf-8");
      const headerLine = content.split("\n")[0].trim();

      expect(headerLine).toBe("Price,SKU,Product Name");
    });

    it("writes row values aligned to their reordered column positions", async () => {
      const content = await readFile(outputFilePath!, "utf-8");
      const dataLine = content.trim().split("\n")[1].trim();

      expect(dataLine).toBe("9.99,WGT-001,Widget A");
    });
  });

  describe("column filtering", () => {
    const tmpInput = join(SAMPLES_DIR, "tmp-map-filter.csv");
    let outputFilePath: string | undefined;

    beforeAll(async () => {
      await writeFile(
        tmpInput,
        "name,price,sku,quantity\nWidget A,9.99,WGT-001,100",
        "utf-8",
      );
      const result = await runStep({
        aborted: false,
        filePath: tmpInput,
        approvedMappings: [
          {
            templateColumn: { title: "Product Name", required: true },
            csvHeader: "name",
            confidence: 1,
          },
          {
            templateColumn: { title: "Price", required: true },
            csvHeader: "price",
            confidence: 1,
          },
          {
            templateColumn: { title: "SKU", required: false },
            csvHeader: undefined,
            confidence: 0,
          },
        ],
      });
      outputFilePath = result.outputFilePath;
    });

    afterAll(async () => {
      await rm(tmpInput, { force: true });

      if (outputFilePath) {
        await rm(outputFilePath, { force: true });
      }
    });

    it("excludes CSV columns not present in approved mappings", async () => {
      const content = await readFile(outputFilePath!, "utf-8");

      expect(content).not.toContain("quantity");
    });

    it("excludes template columns with no csvHeader", async () => {
      const content = await readFile(outputFilePath!, "utf-8");
      const headerLine = content.split("\n")[0];

      expect(headerLine).not.toContain("SKU");
    });

    it("outputs only the two fully mapped columns", async () => {
      const content = await readFile(outputFilePath!, "utf-8");
      const headerLine = content.split("\n")[0].trim();

      expect(headerLine).toBe("Product Name,Price");
    });
  });
});
