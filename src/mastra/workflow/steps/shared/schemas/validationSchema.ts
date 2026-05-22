import { z } from "zod";

export const cellValidationResultSchema = z.object({
  rowIndex: z.number(),
  columnTitle: z.string(),
  originalValue: z.string(),
  fixedValue: z.string().optional(),
  status: z.enum([
    CellValueValidationStatus.AUTO_FIXED,
    CellValueValidationStatus.NEEDS_REVIEW,
  ]),
  failedRules: z.array(z.string()),
});

export const cellValidationResultsSchema = z.array(cellValidationResultSchema);

export type CellValidationResult = z.infer<typeof cellValidationResultSchema>;
export type CellValidationResults = Array<CellValidationResult>;
