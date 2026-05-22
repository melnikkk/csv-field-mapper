import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { access, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import Papa from "papaparse";
import { validateCellValuesStep } from "../";

type StepOutput = {
  validatedFilePath: string;
  autoFixed: Array<{
    rowIndex: number;
    columnTitle: string;
    originalValue: string;
    fixedValue?: string;
    status: string;
    failedRules: Array<string>;
  }>;
  needsReview: Array<{
    rowIndex: number;
    columnTitle: string;
    originalValue: string;
    status: string;
    failedRules: Array<string>;
  }>;
};

async function createInputFile(rows: Array<Array<string>>): Promise<string> {
  const filePath = join(tmpdir(), `test-validate-input-${randomUUID()}.csv`);
  await writeFile(filePath, Papa.unparse(rows), "utf-8");

  return filePath;
}

async function parseOutputFile(
  filePath: string,
): Promise<Array<Array<string>>> {
  const { readFile } = await import("fs/promises");
  const content = await readFile(filePath, "utf-8");
  const { data } = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: true,
  });
  return data;
}

function runStep(inputData: {
  mappedFilePath: string;
  templateColumns: Array<Record<string, unknown>>;
}): Promise<StepOutput> {
  return validateCellValuesStep.execute({
    inputData,
    bail: (r: unknown) => r,
  } as any) as Promise<StepOutput>;
}

describe("validateCellValuesStep", () => {
  describe("columns with no validators", () => {
    let result: StepOutput;

    beforeAll(async () => {
      const inputPath = await createInputFile([
        ["Name", "Price"],
        ["Widget A", "9.99"],
      ]);
      result = await runStep({
        mappedFilePath: inputPath,
        templateColumns: [
          { title: "Name", required: true },
          { title: "Price", required: true },
        ],
      });
    });

    afterAll(() => rm(result?.validatedFilePath, { force: true }));

    it("produces no autoFixed entries", () => {
      expect(result.autoFixed).toHaveLength(0);
    });

    it("produces no needsReview entries", () => {
      expect(result.needsReview).toHaveLength(0);
    });

    it("output file has unchanged content", async () => {
      const data = await parseOutputFile(result.validatedFilePath);
      expect(data[0]).toEqual(["Name", "Price"]);
      expect(data[1]).toEqual(["Widget A", "9.99"]);
    });
  });

  describe("valid cells", () => {
    let result: StepOutput;

    beforeAll(async () => {
      const inputPath = await createInputFile([
        ["Email"],
        ["alice@example.com"],
        ["bob@example.com"],
      ]);
      result = await runStep({
        mappedFilePath: inputPath,
        templateColumns: [
          { title: "Email", required: true, validators: [{ type: "email" }] },
        ],
      });
    });

    afterAll(() => rm(result?.validatedFilePath, { force: true }));

    it("produces no autoFixed entries", () => {
      expect(result.autoFixed).toHaveLength(0);
    });

    it("produces no needsReview entries", () => {
      expect(result.needsReview).toHaveLength(0);
    });
  });

  describe("invalid cell with no fixer", () => {
    let result: StepOutput;

    beforeAll(async () => {
      const inputPath = await createInputFile([
        ["Email"],
        ["not-an-email"],
        ["valid@example.com"],
      ]);
      result = await runStep({
        mappedFilePath: inputPath,
        templateColumns: [
          { title: "Email", required: true, validators: [{ type: "email" }] },
        ],
      });
    });

    afterAll(() => rm(result?.validatedFilePath, { force: true }));

    it("adds the invalid cell to needsReview", () => {
      expect(result.needsReview).toHaveLength(1);
      expect(result.needsReview[0]).toMatchObject({
        rowIndex: 0,
        columnTitle: "Email",
        originalValue: "not-an-email",
        status: "needsReview",
      });
    });

    it("does not flag valid cells", () => {
      expect(
        result.needsReview.every(
          (c) => c.originalValue !== "valid@example.com",
        ),
      ).toBe(true);
    });

    it("produces no autoFixed entries", () => {
      expect(result.autoFixed).toHaveLength(0);
    });

    it("output file preserves the original invalid value unchanged", async () => {
      const data = await parseOutputFile(result.validatedFilePath);
      expect(data[1][0]).toBe("not-an-email");
    });
  });

  describe("auto-fix resolves violation", () => {
    let result: StepOutput;

    beforeAll(async () => {
      const inputPath = await createInputFile([
        ["Status"],
        ["  ACTIVE  "],
        ["inactive"],
      ]);
      result = await runStep({
        mappedFilePath: inputPath,
        templateColumns: [
          {
            title: "Status",
            required: true,
            validators: [{ type: "enum", values: ["active", "inactive"] }],
            fixerStrategy: "trimAndLower",
          },
        ],
      });
    });

    afterAll(() => rm(result?.validatedFilePath, { force: true }));

    it("adds the fixable cell to autoFixed with the corrected value", () => {
      expect(result.autoFixed).toHaveLength(1);
      expect(result.autoFixed[0]).toMatchObject({
        rowIndex: 0,
        columnTitle: "Status",
        originalValue: "  ACTIVE  ",
        fixedValue: "active",
        status: "autoFixed",
      });
    });

    it("does not add auto-fixed cells to needsReview", () => {
      expect(result.needsReview).toHaveLength(0);
    });

    it("output file contains the fixed value", async () => {
      const data = await parseOutputFile(result.validatedFilePath);
      expect(data[1][0]).toBe("active");
    });

    it("output file preserves already-valid values", async () => {
      const data = await parseOutputFile(result.validatedFilePath);
      expect(data[2][0]).toBe("inactive");
    });
  });

  describe("auto-fix does not resolve violation", () => {
    let result: StepOutput;

    beforeAll(async () => {
      const inputPath = await createInputFile([["Status"], ["  UNKNOWN  "]]);
      result = await runStep({
        mappedFilePath: inputPath,
        templateColumns: [
          {
            title: "Status",
            required: true,
            validators: [{ type: "enum", values: ["active", "inactive"] }],
            fixerStrategy: "trimAndLower",
          },
        ],
      });
    });

    afterAll(() => rm(result?.validatedFilePath, { force: true }));

    it("adds the cell to needsReview", () => {
      expect(result.needsReview).toHaveLength(1);
      expect(result.needsReview[0]).toMatchObject({
        rowIndex: 0,
        columnTitle: "Status",
        originalValue: "  UNKNOWN  ",
        status: "needsReview",
      });
    });

    it("produces no autoFixed entries", () => {
      expect(result.autoFixed).toHaveLength(0);
    });

    it("output file preserves the original value", async () => {
      const data = await parseOutputFile(result.validatedFilePath);
      expect(data[1][0]).toBe("  UNKNOWN  ");
    });
  });

  describe("multiple validator rules", () => {
    let result: StepOutput;

    beforeAll(async () => {
      const inputPath = await createInputFile([["Code"], ["ab"]]);
      result = await runStep({
        mappedFilePath: inputPath,
        templateColumns: [
          {
            title: "Code",
            required: true,
            validators: [
              { type: "minLength", min: 3 },
              {
                type: "regex",
                pattern: "^[A-Z]",
                message: "Must start with uppercase",
              },
            ],
          },
        ],
      });
    });

    afterAll(() => rm(result?.validatedFilePath, { force: true }));

    it("collects all failed rules without short-circuiting", () => {
      expect(result.needsReview[0].failedRules).toHaveLength(2);
    });
  });

  describe("input file cleanup", () => {
    it("deletes mappedFilePath after reading", async () => {
      const inputPath = await createInputFile([["Name"], ["Widget"]]);
      const result = await runStep({
        mappedFilePath: inputPath,
        templateColumns: [{ title: "Name", required: true }],
      });

      await rm(result.validatedFilePath, { force: true });

      await expect(access(inputPath)).rejects.toThrow();
    });
  });
});
