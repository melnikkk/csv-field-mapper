import { z } from "zod";

export const correctedFixSchema = z.object({
  rowIndex: z.number(),
  columnTitle: z.string(),
  fixedValue: z.string(),
});

export const resumeApproveCellValuesFixesStepSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("approve") }),
    z.object({
      action: z.literal("revise"),
      correctedFixes: z.array(correctedFixSchema),
    }),
    z.object({ action: z.literal("abort") }),
  ],
);

export type CorrectedFix = z.infer<typeof correctedFixSchema>;
