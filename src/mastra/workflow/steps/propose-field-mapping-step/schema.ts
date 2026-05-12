import z from "zod";
import { templateColumnSchema } from "../shared/schemas/templateSchema";

export const mappingResultSchema = z.object({
  templateColumn: templateColumnSchema,
  matchedHeader: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type MappingResults = Array<z.infer<typeof mappingResultSchema>>;
