import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import { generateText, Output } from "ai";
import { cellValidationResultsSchema } from "../shared/schemas/validationSchema";
import { templateColumnsSchema } from "../shared/schemas/templateSchema";
import { geminiFlash } from "../../../models";
import { buildCellValuesFixesPrompt } from "./prompts";
import { llmCellFixSuggestionSchema } from "./schema";

export const proposeCellValuesFixesStep = createStep({
  id: "propose-cell-values-fixes-step",
  inputSchema: z.object({
    needsReview: cellValidationResultsSchema,
    templateColumns: templateColumnsSchema,
    validatedFilePath: z.string(),
  }),
  outputSchema: z.object({
    proposedFixes: cellValidationResultsSchema,
    validatedFilePath: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { needsReview, templateColumns, validatedFilePath } = inputData;

    if (needsReview.length === 0) {
      return { proposedFixes: [], validatedFilePath };
    }

    const { output: suggestions } = await generateText({
      model: geminiFlash,
      output: Output.object({ schema: llmCellFixSuggestionSchema }),
      prompt: buildCellValuesFixesPrompt(needsReview, templateColumns),
    });

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

    return { proposedFixes, validatedFilePath };
  },
});
