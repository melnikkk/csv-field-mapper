import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import { generateText, Output } from "ai";
import { cellValidationResultsSchema } from "../../shared/schemas/validationSchema";
import { templateColumnsSchema } from "../../shared/schemas/templateSchema";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import { geminiFlash } from "../../../models";
import { buildCellValuesFixesPrompt } from "./prompts";
import { llmCellFixSuggestionSchema } from "./schema";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";

export const proposeCellValuesFixesStep = createStep({
  id: "propose-cell-values-fixes-step",
  inputSchema: z.object({
    needsReview: cellValidationResultsSchema,
    autoFixed: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
    templateColumns: templateColumnsSchema,
    validatedFilePath: z.string(),
    _runMetrics: runMetricsAccumulatorSchema.optional(),
  }),
  outputSchema: z.object({
    proposedFixes: cellValidationResultsSchema,
    autoFixed: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
    validatedFilePath: z.string(),
    _runMetrics: runMetricsAccumulatorSchema.optional(),
  }),
  execute: async ({ inputData }) => {
    const {
      needsReview,
      autoFixed,
      approvedMappings,
      templateColumns,
      validatedFilePath,
    } = inputData;

    if (needsReview.length === 0) {
      return {
        proposedFixes: [],
        autoFixed,
        approvedMappings,
        validatedFilePath,
        _runMetrics: {
          ...inputData._runMetrics,
          cellFixesLlm: {
            llmCalled: false,
            inputTokens: 0,
            outputTokens: 0,
            durationMs: 0,
          },
        },
      };
    }

    const t0 = performance.now();
    const { output: suggestions, usage } = await generateText({
      model: geminiFlash,
      output: Output.object({ schema: llmCellFixSuggestionSchema }),
      prompt: buildCellValuesFixesPrompt(needsReview, templateColumns),
    });
    const durationMs = performance.now() - t0;

    const fixMap = new Map(
      suggestions.fixes.map((fix) => [
        `${fix.columnTitle}::${fix.rowIndex}`,
        fix.proposedValue,
      ]),
    );

    const proposedFixes = needsReview.map((cell) => {
      const key = `${cell.columnTitle}::${cell.rowIndex}`;
      const proposedValue = fixMap.get(key);
      return proposedValue !== undefined
        ? { ...cell, fixedValue: proposedValue }
        : cell;
    });

    return {
      proposedFixes,
      autoFixed,
      approvedMappings,
      validatedFilePath,
      _runMetrics: {
        ...inputData._runMetrics,
        cellFixesLlm: {
          llmCalled: true,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          durationMs,
        },
      },
    };
  },
});
