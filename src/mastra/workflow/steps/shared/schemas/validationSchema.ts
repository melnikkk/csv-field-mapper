import { z } from "zod";

export const cellValidationResultSchema = z.object({
  rowIndex: z.number(),
  columnTitle: z.string(),
  originalValue: z.string(),
  fixedValue: z.string().optional(),
  status: z.enum(["autoFixed", "needsReview"]),
  failedRules: z.array(z.string()),
});

export const cellValidationResultsSchema = z.array(cellValidationResultSchema);

export type CellValidationResult = z.infer<typeof cellValidationResultSchema>;
