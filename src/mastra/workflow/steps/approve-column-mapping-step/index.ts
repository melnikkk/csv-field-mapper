import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import { resumeApproveColumnMappingStepSchema } from "./schema";
import { isMappingResultsFullyConfident } from "./utils";
import { recordMetrics } from "../../../metrics/record";

export const approveColumnMappingStep = createStep({
  id: "approve-column-mapping-step",
  inputSchema: z.object({
    mappingResults: mappingResultsSchema,
    startedAt: z.string(),
    totalTemplateColumns: z.number(),
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
  execute: async ({ inputData, suspend, resumeData, bail, mastra, runId }) => {
    const { mappingResults, startedAt, totalTemplateColumns, _runMetrics } =
      inputData;

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

      return suspend({ mappingResults });
    }

    const { action } = resumeData;

    if (action === "abort") {
      await recordMetrics({
        startedAt,
        totalTemplateColumns,
        _runMetrics: {
          ..._runMetrics,
          approveMappingHitl: { suspended: true, revisionCount: 0 },
        },
        mastra,
        workflowRunId: runId,
      });

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
