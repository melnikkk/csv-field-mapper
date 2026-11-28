import { beforeEach, describe, expect, mock, it } from "bun:test";
import { proposeCellValuesFixesStep } from "../index";

const mockGenerateText = mock(
  (_args?: unknown): Promise<unknown> => Promise.reject(new Error("LLM down")),
);

mock.module("ai", () => ({
  generateText: mockGenerateText,
  Output: { object: ({ schema }: { schema: unknown }) => schema },
}));
mock.module("../../../models", () => ({ geminiFlash: "mock-gemini" }));

process.env.LLM_RETRY_BACKOFF_MS = "0";

const templateColumns = [
  { title: "Age", required: true, validators: [{ type: "integer" }] },
];

const makeCells = (count: number) =>
  Array.from({ length: count }, (_, rowIndex) => ({
    rowIndex,
    columnTitle: "Age",
    originalValue: "abc",
    status: "needs-review" as const,
    failedRules: ["Must be a whole number"],
  }));

const execute = (count: number) =>
  (proposeCellValuesFixesStep as any).execute({
    inputData: {
      needsReview: makeCells(count),
      autoFixed: [],
      approvedMappings: [],
      templateColumns,
      validatedFilePath: "/tmp/x.csv",
    },
  });

describe("proposeCellValuesFixesStep LLM failure", () => {
  beforeEach(() => mockGenerateText.mockReset());

  it("completes with no fixes and records the error when every call fails", async () => {
    mockGenerateText.mockRejectedValue(new Error("LLM down"));
    const result = await execute(5);

    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    expect(result.proposedFixes).toHaveLength(5);
    expect(
      result.proposedFixes.every((f: any) => f.fixedValue === undefined),
    ).toBe(true);
    expect(result._runMetrics.cellFixesLlm).toMatchObject({
      llmCalled: true,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(result._runMetrics.cellFixesLlm.llmError).toContain("LLM down");
  });

  it("keeps successful batches and sums tokens for them only", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          fixes: [{ columnTitle: "Age", rowIndex: 0, proposedValue: "30" }],
        },
        usage: { inputTokens: 10, outputTokens: 5 },
      })
      .mockRejectedValue(new Error("LLM down"));
    const result = await execute(150);

    expect(result.proposedFixes[0].fixedValue).toBe("30");
    expect(result.proposedFixes[100].fixedValue).toBeUndefined();
    expect(result._runMetrics.cellFixesLlm).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
    });
    expect(result._runMetrics.cellFixesLlm.llmError).toContain("1 batch(es)");
  });

  it("recovers from a transient failure", async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce({
        output: {
          fixes: [{ columnTitle: "Age", rowIndex: 0, proposedValue: "30" }],
        },
        usage: { inputTokens: 1, outputTokens: 1 },
      });
    const result = await execute(1);

    expect(result.proposedFixes[0].fixedValue).toBe("30");
    expect(result._runMetrics.cellFixesLlm.llmError).toBeUndefined();
  });
});
