import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, realpath } from "fs/promises";
import { join } from "path";
import { resolveInputFilePath } from "../resolveInputFilePath";

const REPO_ROOT = join(import.meta.dir, "../../../../../..");
const PRODUCTS_CSV = join(REPO_ROOT, "samples", "products.csv");

const CWDS: Array<[string, string]> = [
  ["repo root", REPO_ROOT],
  ["src/mastra/public (mastra dev)", join(REPO_ROOT, "src/mastra/public")],
  ["nested .mastra/output (mastra start)", join(REPO_ROOT, ".mastra/output")],
];

describe("resolveInputFilePath", () => {
  const originalCwd = process.cwd();
  const originalInputDir = process.env.INPUT_DIR;

  beforeEach(() => {
    delete process.env.INPUT_DIR;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalInputDir === undefined) {
      delete process.env.INPUT_DIR;
    } else {
      process.env.INPUT_DIR = originalInputDir;
    }
  });

  describe.each(CWDS)("with cwd = %s", (_label, cwd) => {
    beforeEach(async () => {
      await mkdir(cwd, { recursive: true });
      process.chdir(cwd);
    });

    it("accepts a relative path to samples/products.csv", async () => {
      expect(await resolveInputFilePath("samples/products.csv")).toBe(
        await realpath(PRODUCTS_CSV),
      );
    });

    it("accepts the absolute path to samples/products.csv", async () => {
      expect(await resolveInputFilePath(PRODUCTS_CSV)).toBe(
        await realpath(PRODUCTS_CSV),
      );
    });

    it("rejects ../../etc/passwd", async () => {
      expect(await resolveInputFilePath("../../etc/passwd")).toBeUndefined();
    });

    it("rejects an absolute path outside the input directory", async () => {
      expect(await resolveInputFilePath("/etc/passwd")).toBeUndefined();
    });
  });
});
