import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import { generateText, Output } from "ai";
import {
  templateColumnsSchema,
  aliasDictionarySchema,
} from "../shared/schemas/templateSchema";
import { llmMapSuggestionSchema } from "./schema";
import {
  getUnmappedTemplateColumnTitles,
  getUnresolvedCsvHeadersWithSamples,
  mapColumnsBasedOnDictionary,
} from "./utils";
import { rowSchema, rowsSchema } from "../shared/schemas/rowsSchema";
import { geminiFlash } from "../../../models";
import { buildColumnMappingPrompt } from "./prompts";
import {
  MappingResults,
  mappingResultsSchema,
} from "../shared/schemas/mappingSchema";

export const proposeColumnMappingStep = createStep({
  id: "propose-column-mapping",
  inputSchema: z.object({
    headerRow: rowSchema,
    sampleRows: rowsSchema,
    templateColumns: templateColumnsSchema,
    aliasDictionary: aliasDictionarySchema.optional(),
  }),
  outputSchema: z.object({
    mappingResults: mappingResultsSchema,
  }),
  execute: async ({ inputData }) => {
    const { headerRow, templateColumns, aliasDictionary, sampleRows } =
      inputData;

    const mappingResults: MappingResults = mapColumnsBasedOnDictionary(
      headerRow,
      templateColumns,
      aliasDictionary,
    );

    const unmappedTemplateColumnTitles =
      getUnmappedTemplateColumnTitles(mappingResults);

    if (unmappedTemplateColumnTitles.length === 0) {
      return { mappingResults };
    }

    const unresolvedHeadersWithSamples = getUnresolvedCsvHeadersWithSamples(
      headerRow,
      mappingResults,
      sampleRows,
    );

    const { output: suggestions } = await generateText({
      model: geminiFlash,
      output: Output.object({ schema: llmMapSuggestionSchema }),
      prompt: buildColumnMappingPrompt(
        unresolvedHeadersWithSamples,
        templateColumns,
      ),
    });

    const claimedCsvHeaders = new Set(
      mappingResults
        .filter((row) => row.csvHeader !== undefined)
        .map((row) => row.csvHeader as string),
    );

    for (const suggestion of suggestions.mappings) {
      if (!suggestion.templateColumnTitle) {
        continue;
      }

      if (!headerRow.includes(suggestion.csvHeader)) {
        continue;
      }

      if (suggestion.confidence < 0.4) {
        continue;
      }

      if (claimedCsvHeaders.has(suggestion.csvHeader)) {
        continue;
      }

      const entry = mappingResults.find(
        (result) =>
          result.templateColumn.title === suggestion.templateColumnTitle &&
          result.csvHeader === undefined,
      );

      if (entry) {
        entry.csvHeader = suggestion.csvHeader;
        entry.confidence = suggestion.confidence;
        claimedCsvHeaders.add(suggestion.csvHeader);
      }
    }

    return { mappingResults };
  },
});
