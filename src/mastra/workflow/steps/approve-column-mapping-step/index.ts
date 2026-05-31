import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { mappingResultsSchema } from "../shared/schemas/mappingSchema";
import { resumeApproveColumnMappingStepSchema } from "./schema";
import { isMappingResultsFullyConfident } from "./utils";

export const approveColumnMappingStep = createStep({
  id: "approve-column-mapping-step",
  inputSchema: z.object({
    mappingResults: mappingResultsSchema,
  }),
  outputSchema: z.object({
    approvedMappings: mappingResultsSchema,
  }),
  suspendSchema: z.object({ mappingResults: mappingResultsSchema }),
  resumeSchema: resumeApproveColumnMappingStepSchema,
  execute: async ({ inputData, suspend, resumeData, bail }) => {
    const { mappingResults } = inputData;

    if (!resumeData) {
      if (isMappingResultsFullyConfident(mappingResults)) {
        return { approvedMappings: mappingResults };
      }

      return suspend({ mappingResults: mappingResults });
    }

    const { action } = resumeData;

    if (action === "abort") {
      return bail({ outputFilePath: undefined });
    }

    const approvedMappings =
      action === "revise" ? resumeData.correctedMappings : mappingResults;

    return { approvedMappings };
  },
});
