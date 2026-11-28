import { describe, expect, it } from "bun:test";
import { access, mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { cleanupIntermediateFiles } from "../cleanupIntermediateFiles";

describe("cleanupIntermediateFiles", () => {
  it("removes existing files and ignores undefined and missing paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cleanup-"));
    const file = join(dir, "a.csv");
    await writeFile(file, "x");

    await cleanupIntermediateFiles([file, undefined, join(dir, "missing.csv")]);

    await expect(access(file)).rejects.toThrow();
  });
});
