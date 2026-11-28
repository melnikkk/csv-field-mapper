import { afterEach, beforeEach, describe, expect, mock, it } from "bun:test";
import { proposeCellValuesFixesStep } from "../index";

type LlmFix = { columnTitle: string; rowIndex: number; proposedValue: string };

const mockGenerateText = mock(
  (_args?: unknown): Promise<unknown> =>
    Promise.resolve({
      output: { fixes: [] as Array<LlmFix> },
      usage: { inputTokens: 10, outputTokens: 5 },
    }),
);

mock.module("ai", () => ({
  generateText: mockGenerateText,
  Output: { object: ({ schema }: { schema: unknown }) => schema },
}));

mock.module("../../../models", () => ({ geminiFlash: "mock-gemini" }));

const templateColumns = [
  {
    title: "Age",
    required: true,
    validators: [{ type: "integer" }, { type: "numeric", min: 0, max: 120 }],
  },
];

type Cell = {
  rowIndex: number;
  columnTitle: string;
  originalValue: string;
  status: "needs-review";
  failedRules: Array<string>;
  fixedValue?: string;
};

const makeCells = (count: number): Array<Cell> =>
  Array.from({ length: count }, (_, rowIndex) => ({
    rowIndex,
    columnTitle: "Age",
    originalValue: "abc",
    status: "needs-review" as const,
    failedRules: ["Must be a number"],
  }));

const execute = (needsReview: Array<Cell>) =>
  (proposeCellValuesFixesStep as any).execute({
    inputData: {
      needsReview,
      autoFixed: [],
      approvedMappings: [],
      templateColumns,
      validatedFilePath: "/tmp/x.csv",
    },
  });

const respondWith = (fixes: Array<LlmFix>) =>
  mockGenerateText.mockImplementationOnce(() =>
    Promise.resolve({
      output: { fixes },
      usage: { inputTokens: 10, outputTokens: 5 },
    }),
  );

describe("proposeCellValuesFixesStep", () => {
  beforeEach(() => {
    mockGenerateText.mockClear();
    delete process.env.CELL_FIX_MAX_CELLS;
  });
  afterEach(() => {
    delete process.env.CELL_FIX_MAX_CELLS;
  });

  describe("re-validation of LLM proposals", () => {
    it("keeps a valid proposal", async () => {
      respondWith([{ columnTitle: "Age", rowIndex: 0, proposedValue: "30" }]);
      const result = await execute(makeCells(1));
      expect(result.proposedFixes[0].fixedValue).toBe("30");
    });

    it("drops a proposal that fails the column validators", async () => {
      respondWith([{ columnTitle: "Age", rowIndex: 0, proposedValue: "999" }]);
      const result = await execute(makeCells(1));
      expect(result.proposedFixes).toHaveLength(1);
      expect(result.proposedFixes[0].fixedValue).toBeUndefined();
    });

    it("drops empty and whitespace-only proposals", async () => {
      respondWith([
        { columnTitle: "Age", rowIndex: 0, proposedValue: "" },
        { columnTitle: "Age", rowIndex: 1, proposedValue: "   " },
      ]);
      const result = await execute(makeCells(2));
      expect(result.proposedFixes).toHaveLength(2);
      expect(
        result.proposedFixes.every((f: Cell) => f.fixedValue === undefined),
      ).toBe(true);
    });

    it("ignores fixes for cells that were not requested", async () => {
      respondWith([
        { columnTitle: "Age", rowIndex: 99, proposedValue: "30" },
        { columnTitle: "Other", rowIndex: 0, proposedValue: "30" },
      ]);
      const result = await execute(makeCells(1));
      expect(result.proposedFixes).toHaveLength(1);
      expect(result.proposedFixes[0].fixedValue).toBeUndefined();
    });
  });

  describe("batching", () => {
    it("splits 250 cells into 3 calls and sums metrics", async () => {
      const result = await execute(makeCells(250));
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      expect(result.proposedFixes).toHaveLength(250);
      expect(result._runMetrics.cellFixesLlm).toMatchObject({
        llmCalled: true,
        inputTokens: 30,
        outputTokens: 15,
      });
      expect(result._runMetrics.cellFixesLlm.durationMs).toBeGreaterThanOrEqual(
        0,
      );
    });

    it("ignores a fix returned in a batch it does not belong to", async () => {
      respondWith([{ columnTitle: "Age", rowIndex: 150, proposedValue: "30" }]);
      const result = await execute(makeCells(250));
      expect(result.proposedFixes[150].fixedValue).toBeUndefined();
    });
  });

  describe("cell cap", () => {
    it("sends only CELL_FIX_MAX_CELLS cells and keeps the rest unfixed", async () => {
      process.env.CELL_FIX_MAX_CELLS = "150";
      const result = await execute(makeCells(300));
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(result.proposedFixes).toHaveLength(300);
    });

    it("defaults to 500 cells", async () => {
      const result = await execute(makeCells(700));
      expect(mockGenerateText).toHaveBeenCalledTimes(5);
      expect(result.proposedFixes).toHaveLength(700);
    });

    it("makes no LLM call when the cap is 0", async () => {
      process.env.CELL_FIX_MAX_CELLS = "0";
      const result = await execute(makeCells(5));
      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(result._runMetrics.cellFixesLlm.llmCalled).toBe(false);
    });
  });
});
