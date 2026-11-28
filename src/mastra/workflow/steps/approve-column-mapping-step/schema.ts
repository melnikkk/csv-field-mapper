import { z } from "zod";

export const correctedMappingSchema = z.object({
  templateColumnTitle: z.string(),
  csvHeader: z.string().nullable(),
});

export const resumeApproveColumnMappingStepSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("approve"),
    }),
    z.object({
      action: z.literal("revise"),
      correctedMappings: z.array(correctedMappingSchema),
    }),
    z.object({
      action: z.literal("abort"),
    }),
  ],
);

export type CorrectedMapping = z.infer<typeof correctedMappingSchema>;
