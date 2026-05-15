import z from "zod";

export const llmMapSuggestionSchema = z.object({
  mappings: z.array(
    z.object({
      csvHeader: z.string(),
      templateColumnTitle: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
