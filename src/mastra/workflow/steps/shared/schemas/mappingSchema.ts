import z from "zod";
import { templateColumnSchema } from "./templateSchema";

export const mappingResultSchema = z.object({
  templateColumn: templateColumnSchema,
  csvHeader: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const mappingResultsSchema = z.array(mappingResultSchema);

export type MappingResults = Array<z.infer<typeof mappingResultSchema>>;
