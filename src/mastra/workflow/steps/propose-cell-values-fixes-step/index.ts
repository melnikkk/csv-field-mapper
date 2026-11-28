import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import { Output } from "ai";
import { cellValidationResultsSchema } from "../../shared/schemas/validationSchema";
import { templateColumnsSchema } from "../../shared/schemas/templateSchema";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import { geminiFlash } from "../../../models";
import { buildCellValuesFixesPrompt } from "./prompts";
import { llmCellFixSuggestionSchema } from "./schema";
import {
  generateTextWithRetry,
  getErrorMessage,
} from "../../shared/utils/generateTextWithRetry";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";
import { runValidators } from "../validate-cell-values-step/utils";
import { CELL_FIX_BATCH_SIZE, getCellFixMaxCells } from "./constants";

const cellKey = (cell: { columnTitle: string; rowIndex: number }): string =>
  `${cell.columnTitle}::${cell.rowIndex}`;

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

    const columnByTitle = new Map(
      templateColumns.map((col) => [col.title, col]),
    );
    const cellsForLlm = needsReview.slice(0, getCellFixMaxCells());
    const fixMap = new Map<string, string>();
    let inputTokens = 0;
    let outputTokens = 0;
    let durationMs = 0;
    const llmErrors: Array<string> = [];

    for (let i = 0; i < cellsForLlm.length; i += CELL_FIX_BATCH_SIZE) {
      const batch = cellsForLlm.slice(i, i + CELL_FIX_BATCH_SIZE);
      const batchKeys = new Set(batch.map(cellKey));
      const t0 = performance.now();
      let suggestions: z.infer<typeof llmCellFixSuggestionSchema>;
      let usage: { inputTokens?: number; outputTokens?: number } | undefined;
      try {
        const result = await generateTextWithRetry({
          model: geminiFlash,
          output: Output.object({ schema: llmCellFixSuggestionSchema }),
          prompt: buildCellValuesFixesPrompt(batch, templateColumns),
        });
        suggestions = result.output;
        usage = result.usage;
      } catch (error) {
        durationMs += performance.now() - t0;
        llmErrors.push(getErrorMessage(error));
        continue;
      }
      durationMs += performance.now() - t0;
      inputTokens += usage?.inputTokens ?? 0;
      outputTokens += usage?.outputTokens ?? 0;

      for (const fix of suggestions.fixes) {
        const key = cellKey(fix);
        if (!batchKeys.has(key) || fix.proposedValue.trim() === "") continue;
        const validators = columnByTitle.get(fix.columnTitle)?.validators ?? [];
        if (runValidators(fix.proposedValue, validators).length === 0) {
          fixMap.set(key, fix.proposedValue);
        }
      }
    }

    const proposedFixes = needsReview.map((cell) => {
      const proposedValue = fixMap.get(cellKey(cell));
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
          llmCalled: cellsForLlm.length > 0,
          inputTokens,
          outputTokens,
          durationMs,
          ...(llmErrors.length > 0 && {
            llmError: `${llmErrors.length} batch(es) failed: ${llmErrors[0]}`,
          }),
        },
      },
    };
  },
});
