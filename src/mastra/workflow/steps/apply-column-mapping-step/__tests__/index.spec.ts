import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";
import { applyColumnMappingStep } from "../";

type Mapping = {
  templateColumn: { title: string; required: boolean };
  csvHeader?: string;
  confidence: number;
};

function runStepRaw(inputData: {
  filePath: string;
  approvedMappings: Array<Mapping>;
}): Promise<unknown> {
  let bailArg: unknown;
  return applyColumnMappingStep
    .execute({
      inputData,
      bail: (r: unknown) => {
        bailArg = r;
        return r;
      },
    } as any)
    .then((result) => bailArg ?? result);
}

type StepOutput = { mappedFilePath: string };

const SAMPLES_DIR = join(import.meta.dir, "../../../../../../samples");

function runStep(inputData: {
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

async function parseOutput(result: StepOutput) {
  const content = await readFile(result.mappedFilePath, "utf-8");
  const { data } = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: true,
  });
  const [headers = [], ...rows] = data;
  return { headers, rows };
}

describe("applyColumnMappingStep", () => {
  describe("mapped rows in file", () => {
    const tmpInput = join(SAMPLES_DIR, "tmp-map-basic.csv");
    let result: StepOutput;

    beforeAll(async () => {
      await writeFile(
        tmpInput,
        "sku,name,price\nWGT-001,Widget A,9.99\nWGT-002,Widget B,14.99",
        "utf-8",
      );

      result = await runStep({
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
    });

    afterAll(async () => {
      await rm(tmpInput, { force: true });
      await rm(result.mappedFilePath, { force: true });
    });

    it("returns a file path", () => {
      expect(result.mappedFilePath).toBeString();
    });

    it("uses template column titles as headers", async () => {
      const { headers } = await parseOutput(result);
      expect(headers).toContain("Product Name");
      expect(headers).toContain("Price");
      expect(headers).toContain("SKU");
    });

    it("does not include original CSV header names", async () => {
      const { headers } = await parseOutput(result);
      expect(headers).not.toContain("name");
      expect(headers).not.toContain("price");
      expect(headers).not.toContain("sku");
    });

    it("preserves all data rows", async () => {
      const { rows } = await parseOutput(result);
      expect(rows).toHaveLength(2);
    });
  });

  describe("column ordering", () => {
    const tmpInput = join(SAMPLES_DIR, "tmp-map-order.csv");
    let result: StepOutput;

    beforeAll(async () => {
      await writeFile(
        tmpInput,
        "sku,name,price\nWGT-001,Widget A,9.99",
        "utf-8",
      );

      result = await runStep({
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
    });

    afterAll(async () => {
      await rm(tmpInput, { force: true });
      await rm(result.mappedFilePath, { force: true });
    });

    it("writes headers in mapping order, not original CSV order", async () => {
      const { headers } = await parseOutput(result);
      expect(headers).toEqual(["Price", "SKU", "Product Name"]);
    });

    it("aligns row values to their reordered column positions", async () => {
      const { rows } = await parseOutput(result);
      expect(rows[0]).toEqual(["9.99", "WGT-001", "Widget A"]);
    });
  });

  describe("column filtering", () => {
    const tmpInput = join(SAMPLES_DIR, "tmp-map-filter.csv");
    let result: StepOutput;

    beforeAll(async () => {
      await writeFile(
        tmpInput,
        "name,price,sku,quantity\nWidget A,9.99,WGT-001,100",
        "utf-8",
      );

      result = await runStep({
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
    });

    afterAll(async () => {
      await rm(tmpInput, { force: true });
      await rm(result.mappedFilePath, { force: true });
    });

    it("excludes template columns with no csvHeader", async () => {
      const { headers } = await parseOutput(result);
      expect(headers).not.toContain("SKU");
    });

    it("outputs only the two fully mapped columns", async () => {
      const { headers } = await parseOutput(result);
      expect(headers).toEqual(["Product Name", "Price"]);
    });

    it("excludes data from unmapped CSV columns", async () => {
      const { rows } = await parseOutput(result);
      expect(rows[0]).toEqual(["Widget A", "9.99"]);
    });
  });

  describe("required column enforcement", () => {
    const tmpInput = join(SAMPLES_DIR, "tmp-map-required.csv");

    beforeAll(async () => {
      await writeFile(tmpInput, "name,price\nWidget A,9.99", "utf-8");
    });

    afterAll(async () => {
      await rm(tmpInput, { force: true });
    });

    it("bails when a required column has no csvHeader", async () => {
      const result = await runStepRaw({
        filePath: tmpInput,
        approvedMappings: [
          {
            templateColumn: { title: "Product Name", required: true },
            csvHeader: "name",
            confidence: 1,
          },
          {
            templateColumn: { title: "SKU", required: true },
            csvHeader: undefined,
            confidence: 0,
          },
        ],
      });

      expect((result as any).mappedFilePath).toBeUndefined();
    });

    it("includes missing required column titles in bail reason", async () => {
      const result = await runStepRaw({
        filePath: tmpInput,
        approvedMappings: [
          {
            templateColumn: { title: "Product Name", required: true },
            csvHeader: "name",
            confidence: 1,
          },
          {
            templateColumn: { title: "SKU", required: true },
            csvHeader: undefined,
            confidence: 0,
          },
          {
            templateColumn: { title: "Category", required: true },
            csvHeader: undefined,
            confidence: 0,
          },
        ],
      });

      expect((result as any).reason).toContain("SKU");
      expect((result as any).reason).toContain("Category");
    });

    it("proceeds normally when all required columns are mapped and optional ones are not", async () => {
      const result = await runStepRaw({
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

      expect((result as any).mappedFilePath).toBeString();
      await rm((result as any).mappedFilePath, { force: true });
    });
  });
});
