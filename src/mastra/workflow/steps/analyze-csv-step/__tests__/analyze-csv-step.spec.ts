import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
const mockRecordMetrics = mock(() => Promise.resolve("/mock/metrics.json"));

mock.module("../../../../metrics/record", () => ({
  recordMetrics: mockRecordMetrics,
}));

import {
  EMPTY_FILE,
  FILE_NOT_UTF8,
  FILE_OUTSIDE_INPUT_DIR,
  FILE_TOO_LARGE,
  SAMPLE_ROW_COUNT,
} from "../constants";
import { analyzeCsvStep } from "../";

type StepOutput = {
  headerRow?: Array<string>;
  sampleRows?: Array<Array<string>>;
  totalRows?: number;
  reason?: string;
};

const SAMPLES_DIR = join(import.meta.dir, "../../../../../../samples");
const STARTED_AT = new Date().toISOString();

function runStep(
  filePath: string,
  maxFileSize = Infinity,
): Promise<StepOutput> {
  return analyzeCsvStep.execute({
    inputData: {
      filePath,
      maxFileSize,
      startedAt: STARTED_AT,
      totalTemplateColumns: 3,
    },
    bail: (r: unknown) => r,
  } as any) as Promise<StepOutput>;
}

describe("analyzeCsvStep", () => {
  beforeEach(() => mockRecordMetrics.mockClear());

  describe("well-formed CSV", () => {
    const filePath = join(SAMPLES_DIR, "well-formed.csv");

    it("parses header row", async () => {
      const result = await runStep(filePath);

      expect(result.headerRow).toEqual(["name", "price", "sku", "quantity"]);
    });

    it("excludes header from totalRows count", async () => {
      const result = await runStep(filePath);

      expect(result.totalRows).toBe(3);
    });

    it("returns all data rows in sampleRows when count is within limit", async () => {
      const result = await runStep(filePath);

      expect(result.sampleRows).toHaveLength(3);
    });
  });

  describe("header-only CSV", () => {
    const filePath = join(SAMPLES_DIR, "header-only.csv");

    it("returns empty sampleRows", async () => {
      const result = await runStep(filePath);

      expect(result.sampleRows).toEqual([]);
    });

    it("returns totalRows of 0", async () => {
      const result = await runStep(filePath);

      expect(result.totalRows).toBe(0);
    });
  });

  describe(`CSV with more than ${SAMPLE_ROW_COUNT} data rows`, () => {
    const filePath = join(SAMPLES_DIR, "large.csv");

    it(`caps sampleRows at ${SAMPLE_ROW_COUNT}`, async () => {
      const result = await runStep(filePath);

      expect(result.sampleRows).toHaveLength(SAMPLE_ROW_COUNT);
    });

    it("totalRows reflects actual data row count, not sample size", async () => {
      const result = await runStep(filePath);

      expect(result.totalRows).toBe(8);
    });
  });

  describe("Windows line endings (\\r\\n)", () => {
    const filePath = join(SAMPLES_DIR, "windows-line-endings.csv");

    it("parses correctly without errors", async () => {
      const result = await runStep(filePath);

      expect(result.headerRow).toEqual(["name", "price", "sku"]);
      expect(result.totalRows).toBe(2);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("UTF-8 special characters", () => {
    const filePath = join(SAMPLES_DIR, "special-chars.csv");

    it("preserves non-ASCII characters in values", async () => {
      const result = await runStep(filePath);

      expect(result.sampleRows?.[0]).toContain("Ñoño Product");
      expect(result.reason).toBeUndefined();
    });
  });

  describe("file containing UTF-8 replacement character (\\uFFFD)", () => {
    const tmpFile = join(SAMPLES_DIR, "tmp-invalid-encoding.csv");

    beforeAll(async () => {
      await writeFile(tmpFile, `name,price\nProduct�,10`);
    });

    afterAll(async () => {
      await rm(tmpFile, { force: true });
    });

    it("bails with the encoding reason and records metrics", async () => {
      const result = await runStep(tmpFile);

      expect(result).toEqual({ reason: FILE_NOT_UTF8 });
      expect(mockRecordMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe("empty file", () => {
    const tmpFile = join(SAMPLES_DIR, "tmp-empty.csv");

    beforeAll(async () => {
      await writeFile(tmpFile, "");
    });

    afterAll(async () => {
      await rm(tmpFile, { force: true });
    });

    it("bails with the empty-file reason and records metrics", async () => {
      const result = await runStep(tmpFile);

      expect(result).toEqual({ reason: EMPTY_FILE });
      expect(mockRecordMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe("input directory restriction", () => {
    const originalInputDir = process.env.INPUT_DIR;
    let workDir: string;
    let insideFile: string;
    let outsideFile: string;

    beforeAll(async () => {
      workDir = await mkdtemp(join(tmpdir(), "analyze-csv-"));
      await mkdir(join(workDir, "inbox"));
      insideFile = join(workDir, "inbox", "ok.csv");
      outsideFile = join(workDir, "secret.csv");
      await writeFile(insideFile, "name,price\nA,1");
      await writeFile(outsideFile, "name,price\nB,2");
      await symlink(outsideFile, join(workDir, "inbox", "link.csv"));
    });

    afterAll(async () => {
      process.env.INPUT_DIR = originalInputDir;
      if (originalInputDir === undefined) delete process.env.INPUT_DIR;
      await rm(workDir, { recursive: true, force: true });
    });

    beforeEach(() => {
      process.env.INPUT_DIR = join(workDir, "inbox");
    });

    it("accepts a file inside INPUT_DIR", async () => {
      const result = await runStep(insideFile);

      expect(result.reason).toBeUndefined();
      expect(result.headerRow).toEqual(["name", "price"]);
    });

    it("bails on a file outside INPUT_DIR and records metrics", async () => {
      const result = await runStep(outsideFile);

      expect(result).toEqual({ reason: FILE_OUTSIDE_INPUT_DIR });
      expect(mockRecordMetrics).toHaveBeenCalledTimes(1);
    });

    it("bails on ../ traversal out of INPUT_DIR", async () => {
      const result = await runStep(join(workDir, "inbox", "..", "secret.csv"));

      expect(result).toEqual({ reason: FILE_OUTSIDE_INPUT_DIR });
    });

    it("bails on a symlink inside INPUT_DIR that points outside", async () => {
      const result = await runStep(join(workDir, "inbox", "link.csv"));

      expect(result).toEqual({ reason: FILE_OUTSIDE_INPUT_DIR });
    });

    it("bails on a relative ../../etc/passwd style path", async () => {
      const result = await runStep("../../etc/passwd");

      expect(result).toEqual({ reason: FILE_OUTSIDE_INPUT_DIR });
    });

    it("bails when the file does not exist", async () => {
      const result = await runStep(join(workDir, "inbox", "missing.csv"));

      expect(result).toEqual({ reason: FILE_OUTSIDE_INPUT_DIR });
    });
  });

  describe("file size validation", () => {
    const filePath = join(SAMPLES_DIR, "well-formed.csv");

    it("bails with FILE_TOO_LARGE and records metrics when file exceeds maxFileSize", async () => {
      const result = await runStep(filePath, 50);

      expect(result).toEqual({ reason: FILE_TOO_LARGE });
      expect(mockRecordMetrics).toHaveBeenCalledTimes(1);
    });

    it("parses normally when file is within maxFileSize", async () => {
      const result = await runStep(filePath, 200);

      expect(result.reason).toBeUndefined();
      expect(result.headerRow).toEqual(["name", "price", "sku", "quantity"]);
    });
  });
});
