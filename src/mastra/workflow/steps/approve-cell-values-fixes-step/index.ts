import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { cellValidationResultsSchema } from "../shared/schemas/validationSchema";
import { mappingResultsSchema } from "../shared/schemas/mappingSchema";
import { resumeApproveCellValuesFixesStepSchema } from "./schema";

export const approveCellValuesFixesStep = createStep({
  id: "approve-cell-values-fixes-step",
  inputSchema: z.object({
    proposedFixes: cellValidationResultsSchema,
    autoFixed: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
    validatedFilePath: z.string(),
  }),
  outputSchema: z.object({
    approvedFixes: cellValidationResultsSchema,
    autoFixed: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
    validatedFilePath: z.string(),
  }),
  suspendSchema: z.object({
    proposedFixes: cellValidationResultsSchema,
    autoFixed: cellValidationResultsSchema,
  }),
  resumeSchema: resumeApproveCellValuesFixesStepSchema,
  execute: async ({ inputData, suspend, resumeData, bail }) => {
    const { validatedFilePath, proposedFixes, autoFixed, approvedMappings } =
      inputData;

    if (!resumeData) {
      if (proposedFixes.length === 0) {
        return {
          approvedFixes: [],
          autoFixed,
          approvedMappings,
          validatedFilePath,
        };
      }

      return suspend({ proposedFixes, autoFixed });
    }

    const { action } = resumeData;

    if (action === "abort") {
      return bail({ outputFilePath: undefined });
    }

    const approvedFixes =
      resumeData.action === "revise"
        ? resumeData.correctedFixes
        : inputData.proposedFixes;

    return { approvedFixes, autoFixed, approvedMappings, validatedFilePath };
  },
});
