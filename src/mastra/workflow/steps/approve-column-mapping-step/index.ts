import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import { resumeApproveColumnMappingStepSchema } from "./schema";
import { isMappingResultsFullyConfident } from "./utils";

export const approveColumnMappingStep = createStep({
  id: "approve-column-mapping-step",
  inputSchema: z.object({
    mappingResults: mappingResultsSchema,
    _runMetrics: runMetricsAccumulatorSchema.optional(),
  }),
  outputSchema: z.object({
    approvedMappings: mappingResultsSchema.optional(),
    outputFilePath: z.string().optional(),
    reason: z.string().optional(),
    _runMetrics: runMetricsAccumulatorSchema,
  }),
  suspendSchema: z.object({ mappingResults: mappingResultsSchema }),
  resumeSchema: resumeApproveColumnMappingStepSchema,
  execute: async ({ inputData, suspend, resumeData, bail }) => {
    const { mappingResults, _runMetrics } = inputData;

    if (!resumeData) {
      if (isMappingResultsFullyConfident(mappingResults)) {
        return {
          approvedMappings: mappingResults,
          _runMetrics: {
            ..._runMetrics,
            approveMappingHitl: { suspended: false, revisionCount: 0 },
          },
        };
      }

      return suspend({ mappingResults: mappingResults });
    }

    const { action } = resumeData;

    if (action === "abort") {
      return bail({
        outputFilePath: undefined,
        reason: "User aborted column mapping",
      });
    }

    const approvedMappings =
      action === "revise" ? resumeData.correctedMappings : mappingResults;

    return {
      approvedMappings,
      _runMetrics: {
        ..._runMetrics,
        approveMappingHitl: {
          suspended: true,
          revisionCount: action === "revise" ? 1 : 0,
        },
      },
    };
  },
});
