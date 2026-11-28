import { beforeEach, describe, expect, mock, it } from "bun:test";
import { proposeColumnMappingStep } from "../index";

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
  { title: "First Name", required: true },
  { title: "Last Name", required: true },
];

const execute = () =>
  (proposeColumnMappingStep as any).execute({
    inputData: {
      headerRow: ["fname", "last_name"],
      sampleRows: [],
      templateColumns,
      aliasDictionary: { "Last Name": ["last_name"] },
    },
  });

describe("proposeColumnMappingStep LLM failure", () => {
  beforeEach(() => mockGenerateText.mockReset());

  it("degrades to dictionary-only mapping and records the error", async () => {
    mockGenerateText.mockRejectedValue(new Error("LLM down"));
    const result = await execute();

    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    const first = result.mappingResults.find(
      (r: any) => r.templateColumn.title === "First Name",
    );
    const last = result.mappingResults.find(
      (r: any) => r.templateColumn.title === "Last Name",
    );
    expect(first.csvHeader).toBeUndefined();
    expect(first.confidence).toBe(0);
    expect(last.csvHeader).toBe("last_name");
    expect(result._runMetrics.columnMappingLlm).toMatchObject({
      llmCalled: true,
      llmMapped: 0,
      unmapped: 1,
      llmError: "LLM down",
    });
  });

  it("recovers from a transient failure", async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce({
        output: {
          mappings: [
            {
              csvHeader: "fname",
              templateColumnTitle: "First Name",
              confidence: 0.9,
            },
          ],
        },
        usage: { inputTokens: 1, outputTokens: 1 },
      });
    const result = await execute();

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(result._runMetrics.columnMappingLlm.llmError).toBeUndefined();
    expect(result._runMetrics.columnMappingLlm.llmMapped).toBe(1);
  });
});
