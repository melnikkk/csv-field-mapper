import { describe, expect, it } from "bun:test";
import { templateSchema } from "../templateSchema";
import { workflowInputDataSchema } from "../workflowInputSchema";

const templateWithPattern = (pattern: string) => ({
  maxFileSize: 1000,
  columns: [
    {
      title: "code",
      required: true,
      validators: [{ type: "regex", pattern }],
    },
  ],
});

describe("templateSchema regex validators", () => {
  it("accepts a valid pattern", () => {
    expect(
      templateSchema.safeParse(templateWithPattern("^[A-Z]+$")).success,
    ).toBe(true);
  });

  it("rejects an invalid pattern", () => {
    expect(templateSchema.safeParse(templateWithPattern("([a-z")).success).toBe(
      false,
    );
  });

  it("rejects a pattern longer than 500 characters", () => {
    expect(
      templateSchema.safeParse(templateWithPattern("a".repeat(501))).success,
    ).toBe(false);
  });

  it("accepts a pattern of exactly 500 characters", () => {
    expect(
      templateSchema.safeParse(templateWithPattern("a".repeat(500))).success,
    ).toBe(true);
  });

  it("is enforced by workflowInputDataSchema", () => {
    const result = workflowInputDataSchema.safeParse({
      filePath: "x.csv",
      template: templateWithPattern("(unclosed"),
    });

    expect(result.success).toBe(false);
  });
});
