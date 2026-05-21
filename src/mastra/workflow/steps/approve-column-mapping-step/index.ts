import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { mappingResultsSchema } from "../shared/schemas/mappingSchema";
import { resumeApproveColumnMappingStepSchema } from "./schema";

export const approveColumnMappingStep = createStep({
  id: "approve-column-mapping-step",
  inputSchema: z.object({
    mappingResults: mappingResultsSchema,
  }),
  outputSchema: z.object({
    approvedMappings: mappingResultsSchema,
    aborted: z.boolean(),
  }),
  suspendSchema: z.object({ mappingResults: mappingResultsSchema }),
  resumeSchema: resumeApproveColumnMappingStepSchema,
  execute: async ({ inputData, suspend, resumeData }) => {
    if (resumeData) {
      if (resumeData.action === "abort") {
        return { approvedMappings: [], aborted: true };
      }

      if (resumeData.action === "revise") {
        return suspend({ mappingResults: resumeData.correctedMappings });
      }

      return { approvedMappings: inputData.mappingResults, aborted: false };
    }

    return suspend({ mappingResults: inputData.mappingResults });
  },
});
