import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import { generateText, Output } from "ai";
import {
  templateColumnsSchema,
  aliasDictionarySchema,
} from "../../shared/schemas/templateSchema";
import { llmMapSuggestionSchema } from "./schema";
import {
  getUnmappedTemplateColumnTitles,
  getUnresolvedCsvHeadersWithSamples,
  mapColumnsBasedOnDictionary,
} from "./utils";
import { rowSchema, rowsSchema } from "../../shared/schemas/rowsSchema";
import { geminiFlash } from "../../../models";
import { buildColumnMappingPrompt } from "./prompts";
import {
  MappingResults,
  mappingResultsSchema,
} from "../../shared/schemas/mappingSchema";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";

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
    _runMetrics: runMetricsAccumulatorSchema,
  }),
  execute: async ({ inputData }) => {
    const { headerRow, templateColumns, aliasDictionary, sampleRows } =
      inputData;

    const mappingResults: MappingResults = mapColumnsBasedOnDictionary(
      headerRow,
      templateColumns,
      aliasDictionary,
    );

    const aliasDictMappedHeaders = new Set(
      mappingResults
        .filter((r) => r.csvHeader !== undefined)
        .map((r) => r.csvHeader as string),
    );

    const unmappedTemplateColumnTitles =
      getUnmappedTemplateColumnTitles(mappingResults);

    if (unmappedTemplateColumnTitles.length === 0) {
      return {
        mappingResults,
        _runMetrics: {
          columnMappingLlm: {
            aliasDictMapped: aliasDictMappedHeaders.size,
            llmMapped: 0,
            unmapped: 0,
            avgLlmConfidence: null,
            llmCalled: false,
            inputTokens: 0,
            outputTokens: 0,
            durationMs: 0,
          },
        },
      };
    }

    const unresolvedHeadersWithSamples = getUnresolvedCsvHeadersWithSamples(
      headerRow,
      mappingResults,
      sampleRows,
    );

    const t0 = performance.now();
    const { output: suggestions, usage } = await generateText({
      model: geminiFlash,
      output: Output.object({ schema: llmMapSuggestionSchema }),
      prompt: buildColumnMappingPrompt(
        unresolvedHeadersWithSamples,
        templateColumns,
      ),
    });
    const durationMs = performance.now() - t0;

    const claimedCsvHeaders = new Set(aliasDictMappedHeaders);

    for (const suggestion of suggestions.mappings) {
      if (!suggestion.templateColumnTitle) continue;
      if (!headerRow.includes(suggestion.csvHeader)) continue;
      if (suggestion.confidence < 0.4) continue;
      if (claimedCsvHeaders.has(suggestion.csvHeader)) continue;

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

    const llmMappedEntries = mappingResults.filter(
      (r) =>
        r.csvHeader !== undefined && !aliasDictMappedHeaders.has(r.csvHeader),
    );
    const llmMappedCount = llmMappedEntries.length;
    const unmappedCount = mappingResults.filter(
      (r) => r.csvHeader === undefined,
    ).length;
    const avgLlmConfidence =
      llmMappedCount > 0
        ? llmMappedEntries.reduce((sum, e) => sum + (e.confidence ?? 0), 0) /
          llmMappedCount
        : null;

    return {
      mappingResults,
      _runMetrics: {
        columnMappingLlm: {
          aliasDictMapped: aliasDictMappedHeaders.size,
          llmMapped: llmMappedCount,
          unmapped: unmappedCount,
          avgLlmConfidence,
          llmCalled: true,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          durationMs,
        },
      },
    };
  },
});
