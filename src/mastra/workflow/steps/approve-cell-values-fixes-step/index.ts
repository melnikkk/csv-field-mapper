import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { cellValidationResultsSchema } from "../shared/schemas/validationSchema";
import { resumeApproveCellValuesFixesStepSchema } from "./schema";

export const approveCellValuesFixesStep = createStep({
  id: "approve-cell-values-fixes-step",
  inputSchema: z.object({
    proposedFixes: cellValidationResultsSchema,
    validatedFilePath: z.string(),
  }),
  outputSchema: z.object({
    approvedFixes: cellValidationResultsSchema,
    validatedFilePath: z.string(),
  }),
  suspendSchema: z.object({ proposedFixes: cellValidationResultsSchema }),
  resumeSchema: resumeApproveCellValuesFixesStepSchema,
  execute: async ({ inputData, suspend, resumeData, bail }) => {
    if (!resumeData) {
      if (inputData.proposedFixes.length === 0) {
        return {
          approvedFixes: [],
          validatedFilePath: inputData.validatedFilePath,
        };
      }

      return suspend({ proposedFixes: inputData.proposedFixes });
    }

    if (resumeData.action === "abort") {
      return bail({ outputFilePath: undefined });
    }

    const approvedFixes =
      resumeData.action === "revise"
        ? resumeData.correctedFixes
        : inputData.proposedFixes;

    return { approvedFixes, validatedFilePath: inputData.validatedFilePath };
  },
});
