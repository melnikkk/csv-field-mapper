import { describe, it, expect, afterEach } from "bun:test";
import { applyCellValuesFixesStep } from "../index";
import { CellValueValidationStatus } from "../../validate-cell-values-step/constants";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type { CellValidationResult } from "../../shared/schemas/validationSchema";

const makeFix = (
  overrides?: Partial<CellValidationResult>,
): CellValidationResult => ({
  rowIndex: 0,
  columnTitle: "Name",
  originalValue: "bad",
  fixedValue: "good",
  status: CellValueValidationStatus.AUTO_FIXED,
  failedRules: [],
  ...overrides,
});

const writeTempCsv = async (content: string): Promise<string> => {
  const dir = join(tmpdir(), `apply-fixes-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "input.csv");
  await writeFile(path, content, "utf-8");
  return path;
};

const runExecute = (inputData: {
  approvedFixes: CellValidationResult[];
  validatedFilePath: string;
}) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (applyCellValuesFixesStep as any).execute({ inputData });

describe("applyCellValuesFixesStep", () => {
  const outputsToClean: string[] = [];

  afterEach(async () => {
    for (const path of outputsToClean.splice(0)) {
      await rm(path, { force: true });
    }
  });

  it("returns original file path when approvedFixes is empty", async () => {
    const result = await runExecute({
      approvedFixes: [],
      validatedFilePath: "/tmp/some.csv",
    });
    expect(result).toEqual({ outputFilePath: "/tmp/some.csv" });
  });

  it("returns original file path when no fix has a fixedValue", async () => {
    const result = await runExecute({
      approvedFixes: [makeFix({ fixedValue: undefined })],
      validatedFilePath: "/tmp/some.csv",
    });
    expect(result).toEqual({ outputFilePath: "/tmp/some.csv" });
  });

  it("writes a new CSV file with the fixed value applied", async () => {
    const inputPath = await writeTempCsv("Name,Age\nbad,25\n");
    const { outputFilePath } = await runExecute({
      approvedFixes: [
        makeFix({ rowIndex: 0, columnTitle: "Name", fixedValue: "fixed" }),
      ],
      validatedFilePath: inputPath,
    });
    outputsToClean.push(outputFilePath);

    const output = await readFile(outputFilePath, "utf-8");
    expect(output).toContain("fixed");
    expect(output).not.toContain("bad");
  });

  it("deletes the original validated file after applying fixes", async () => {
    const inputPath = await writeTempCsv("Name,Age\nbad,25\n");
    const { outputFilePath } = await runExecute({
      approvedFixes: [
        makeFix({ rowIndex: 0, columnTitle: "Name", fixedValue: "fixed" }),
      ],
      validatedFilePath: inputPath,
    });
    outputsToClean.push(outputFilePath);

    const exists = await readFile(inputPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("applies the fix only to the targeted row, leaving other rows unchanged", async () => {
    const inputPath = await writeTempCsv("Name,Age\nrow0,25\nrow1,30\n");
    const { outputFilePath } = await runExecute({
      approvedFixes: [
        makeFix({ rowIndex: 1, columnTitle: "Name", fixedValue: "fixed1" }),
      ],
      validatedFilePath: inputPath,
    });
    outputsToClean.push(outputFilePath);

    const output = await readFile(outputFilePath, "utf-8");
    expect(output).toContain("row0");
    expect(output).toContain("fixed1");
    expect(output).not.toContain("row1");
  });

  it("leaves other columns unchanged when applying a fix", async () => {
    const inputPath = await writeTempCsv("Name,Age\nbad,25\n");
    const { outputFilePath } = await runExecute({
      approvedFixes: [
        makeFix({ rowIndex: 0, columnTitle: "Name", fixedValue: "fixed" }),
      ],
      validatedFilePath: inputPath,
    });
    outputsToClean.push(outputFilePath);

    const output = await readFile(outputFilePath, "utf-8");
    expect(output).toContain("25");
  });

  it("silently skips a fix whose rowIndex is out of bounds", async () => {
    const inputPath = await writeTempCsv("Name,Age\nrow0,25\n");
    const { outputFilePath } = await runExecute({
      approvedFixes: [
        makeFix({ rowIndex: 99, columnTitle: "Name", fixedValue: "oob" }),
      ],
      validatedFilePath: inputPath,
    });
    outputsToClean.push(outputFilePath);

    const output = await readFile(outputFilePath, "utf-8");
    expect(output).toContain("row0");
    expect(output).not.toContain("oob");
  });

  it("ignores fixes that reference an unknown column name", async () => {
    const inputPath = await writeTempCsv("Name,Age\nbad,25\n");
    const { outputFilePath } = await runExecute({
      approvedFixes: [
        makeFix({ columnTitle: "DoesNotExist", fixedValue: "irrelevant" }),
      ],
      validatedFilePath: inputPath,
    });
    outputsToClean.push(outputFilePath);

    const output = await readFile(outputFilePath, "utf-8");
    expect(output).toContain("bad");
  });
});
