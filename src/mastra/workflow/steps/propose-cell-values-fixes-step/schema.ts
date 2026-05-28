import z from "zod";

export const llmCellFixSuggestionSchema = z.object({
  fixes: z.array(
    z.object({
      columnTitle: z.string(),
      rowIndex: z.number(),
      proposedValue: z.string(),
    }),
  ),
});
