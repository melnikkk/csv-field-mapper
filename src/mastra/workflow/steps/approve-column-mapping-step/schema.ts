import { z } from "zod";
import { mappingResultsSchema } from "../shared/schemas/mappingSchema";

export const resumeApproveColumnMappingStepSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("approve"),
    }),
    z.object({
      action: z.literal("revise"),
      correctedMappings: mappingResultsSchema,
    }),
    z.object({
      action: z.literal("abort"),
    }),
  ],
);
