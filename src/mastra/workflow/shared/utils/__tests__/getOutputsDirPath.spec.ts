import { describe, it, expect } from "bun:test";
import { getOutputsDirPath } from "../getOutputsDirPath";

describe("getOutputsDirPath", () => {
  it("returns an absolute path ending with 'outputs'", () => {
    const path = getOutputsDirPath();
    expect(path.startsWith("/")).toBe(true);
    expect(path).toMatch(/\/outputs$/);
  });
});
