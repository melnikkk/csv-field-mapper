import { z } from "zod";
import { cellValidationResultsSchema } from "./validationSchema";
import { mappingResultsSchema } from "./mappingSchema";

export const workflowOutputSchema = z.object({
  outputFilePath: z.string().optional(),
  autoFixed: cellValidationResultsSchema.optional(),
  appliedFixes: cellValidationResultsSchema.optional(),
  approvedMappings: mappingResultsSchema.optional(),
  reason: z.string().optional(),
});
