import { beforeEach, describe, expect, mock, it } from "bun:test";
import { proposeColumnMappingStep } from "../index";

type LlmMapping = {
  csvHeader: string;
  templateColumnTitle: string | null;
  confidence: number;
};

const mockGenerateText = mock(() =>
  Promise.resolve({
    output: { mappings: [] as Array<LlmMapping> },
    usage: { inputTokens: 100, outputTokens: 50 },
  }),
);

mock.module("ai", () => ({
  generateText: mockGenerateText,
  Output: {
    object: ({ schema }: { schema: unknown }) => schema,
  },
}));

mock.module("../../../models", () => ({
  geminiFlash: "mock-gemini",
}));

const templateColumns = [
  { title: "First Name", required: true },
  { title: "Last Name", required: true },
];

type ExecuteInput = {
  headerRow: Array<string>;
  sampleRows: Array<Array<string>>;
  templateColumns: typeof templateColumns;
  aliasDictionary?: Record<string, Array<string>>;
};

const execute = (inputData: ExecuteInput) =>
  (proposeColumnMappingStep as any).execute({ inputData });

describe("proposeColumnMappingStep", () => {
  beforeEach(() => mockGenerateText.mockClear());

  describe("when all columns are resolved by the alias dictionary", () => {
    it("returns mapping results without calling the LLM", async () => {
      const result = await execute({
        headerRow: ["first_name", "last_name"],
        sampleRows: [["Alice", "Smith"]],
        templateColumns,
        aliasDictionary: {
          "First Name": ["first_name"],
          "Last Name": ["last_name"],
        },
      });

      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(result.mappingResults).toHaveLength(2);
      result.mappingResults.forEach((r: { confidence: number }) =>
        expect(r.confidence).toBe(1),
      );
      expect(result._runMetrics.columnMappingLlm).toMatchObject({
        llmCalled: false,
        aliasDictMapped: 2,
        llmMapped: 0,
        unmapped: 0,
        inputTokens: 0,
        outputTokens: 0,
      });
      expect(result._runMetrics.columnMappingLlm?.avgLlmConfidence).toBeNull();
    });
  });

  describe("when there are columns not resolved by the dictionary", () => {
    it("calls the LLM with unresolved headers", async () => {
      await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("applies LLM suggestions for unmapped columns", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({
          output: {
            mappings: [
              {
                csvHeader: "fname",
                templateColumnTitle: "First Name",
                confidence: 0.9,
              },
            ],
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      );

      const result = await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [["Alice", "Smith"]],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      const firstNameEntry = result.mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "First Name",
      );
      expect(firstNameEntry?.csvHeader).toBe("fname");
      expect(firstNameEntry?.confidence).toBe(0.9);
      expect(result._runMetrics.columnMappingLlm).toMatchObject({
        llmCalled: true,
        aliasDictMapped: 1,
        llmMapped: 1,
        unmapped: 0,
        inputTokens: 100,
        outputTokens: 50,
      });
      expect(result._runMetrics.columnMappingLlm?.avgLlmConfidence).toBeCloseTo(
        0.9,
        5,
      );
    });

    it("skips LLM suggestion when templateColumnTitle is null", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({
          output: {
            mappings: [
              {
                csvHeader: "fname",
                templateColumnTitle: null,
                confidence: 0.3,
              },
            ],
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      );

      const { mappingResults } = await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      const firstNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "First Name",
      );
      expect(firstNameEntry?.csvHeader).toBeUndefined();
      expect(firstNameEntry?.confidence).toBe(0);
    });

    it("does not overwrite an already-mapped column with an LLM suggestion", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({
          output: {
            mappings: [
              {
                csvHeader: "also_last",
                templateColumnTitle: "Last Name",
                confidence: 0.7,
              },
            ],
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      );

      const { mappingResults } = await execute({
        headerRow: ["first_name", "last_name", "also_last"],
        sampleRows: [],
        templateColumns,
        aliasDictionary: {
          "First Name": ["first_name"],
          "Last Name": ["last_name"],
        },
      });

      const lastNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "Last Name",
      );
      expect(lastNameEntry?.csvHeader).toBe("last_name");
      expect(lastNameEntry?.confidence).toBe(1);
    });

    it("ignores LLM suggestion when csvHeader is not in headerRow", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({
          output: {
            mappings: [
              {
                csvHeader: "nonexistent_column",
                templateColumnTitle: "First Name",
                confidence: 0.9,
              },
            ],
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      );

      const { mappingResults } = await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      const firstNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "First Name",
      );
      expect(firstNameEntry?.csvHeader).toBeUndefined();
    });

    it("ignores LLM suggestion when csvHeader is already claimed by another mapping (first-wins)", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({
          output: {
            mappings: [
              {
                csvHeader: "fname",
                templateColumnTitle: "First Name",
                confidence: 0.9,
              },
              {
                csvHeader: "fname",
                templateColumnTitle: "Last Name",
                confidence: 0.8,
              },
            ],
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      );

      const { mappingResults } = await execute({
        headerRow: ["fname"],
        sampleRows: [],
        templateColumns,
      });

      const firstNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "First Name",
      );
      const lastNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "Last Name",
      );

      expect(firstNameEntry?.csvHeader).toBe("fname");
      expect(lastNameEntry?.csvHeader).toBeUndefined();
    });

    it("ignores LLM suggestion when confidence is below 0.4", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({
          output: {
            mappings: [
              {
                csvHeader: "fname",
                templateColumnTitle: "First Name",
                confidence: 0.39,
              },
            ],
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      );

      const { mappingResults } = await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      const firstNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "First Name",
      );
      expect(firstNameEntry?.csvHeader).toBeUndefined();
    });

    it("applies LLM suggestion when confidence is exactly 0.4", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({
          output: {
            mappings: [
              {
                csvHeader: "fname",
                templateColumnTitle: "First Name",
                confidence: 0.4,
              },
            ],
          },
          usage: { inputTokens: 100, outputTokens: 50 },
        }),
      );

      const { mappingResults } = await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      const firstNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "First Name",
      );
      expect(firstNameEntry?.csvHeader).toBe("fname");
    });
  });
});
