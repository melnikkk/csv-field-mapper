import { z } from "zod";
import { cellValidationResultsSchema } from "../shared/schemas/validationSchema";

export const resumeApproveCellValuesFixesStepSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("approve") }),
    z.object({
      action: z.literal("revise"),
      correctedFixes: cellValidationResultsSchema,
    }),
    z.object({ action: z.literal("abort") }),
  ],
);
