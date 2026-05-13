import { beforeEach, describe, expect, mock, test } from "bun:test";

type LlmMapping = {
  csvHeader: string;
  templateColumnTitle: string | null;
  confidence: number;
};

const mockGenerateText = mock(() =>
  Promise.resolve({ output: { mappings: [] as LlmMapping[] } }),
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

const { proposeFieldMappingStep } = await import("../index");

const templateColumns = [
  { title: "First Name", required: true },
  { title: "Last Name", required: true },
];

type ExecuteInput = {
  headerRow: string[];
  sampleRows: string[][];
  templateColumns: typeof templateColumns;
  aliasDictionary?: Record<string, string[]>;
};

const execute = (inputData: ExecuteInput) =>
  (proposeFieldMappingStep as any).execute({ inputData });

describe("proposeFieldMappingStep", () => {
  beforeEach(() => mockGenerateText.mockClear());

  describe("when all columns are resolved by the alias dictionary", () => {
    test("returns mapping results without calling the LLM", async () => {
      const { mappingResults } = await execute({
        headerRow: ["first_name", "last_name"],
        sampleRows: [["Alice", "Smith"]],
        templateColumns,
        aliasDictionary: {
          "First Name": ["first_name"],
          "Last Name": ["last_name"],
        },
      });

      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(mappingResults).toHaveLength(2);
      mappingResults.forEach((r: { confidence: number }) =>
        expect(r.confidence).toBe(1),
      );
    });
  });

  describe("when there are columns not resolved by the dictionary", () => {
    test("calls the LLM with unresolved headers", async () => {
      await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    test("applies LLM suggestions for unmapped columns", async () => {
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
        }),
      );

      const { mappingResults } = await execute({
        headerRow: ["fname", "last_name"],
        sampleRows: [["Alice", "Smith"]],
        templateColumns,
        aliasDictionary: { "Last Name": ["last_name"] },
      });

      const firstNameEntry = mappingResults.find(
        (r: { templateColumn: { title: string } }) =>
          r.templateColumn.title === "First Name",
      );
      expect(firstNameEntry?.csvHeader).toBe("fname");
      expect(firstNameEntry?.confidence).toBe(0.9);
    });

    test("skips LLM suggestion when templateColumnTitle is null", async () => {
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

    test("does not overwrite an already-mapped column with an LLM suggestion", async () => {
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
  });
});
