import z from "zod";
import { templateColumnSchema } from "../shared/schemas/templateSchema";

export const mappingResultSchema = z.object({
  templateColumn: templateColumnSchema,
  csvHeader: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const mappingResultsSchema = z.array(mappingResultSchema);

export const llmMapSuggestionSchema = z.object({
  mappings: z.array(
    z.object({
      csvHeader: z.string(),
      templateColumnTitle: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type MappingResults = Array<z.infer<typeof mappingResultSchema>>;
