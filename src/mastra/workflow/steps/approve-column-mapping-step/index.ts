import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import { resumeApproveColumnMappingStepSchema } from "./schema";
import { isMappingResultsFullyConfident } from "./utils";
import { recordMetrics } from "../../../metrics/record";
import { templateColumnsSchema } from "../../shared/schemas/templateSchema";
import { reviseMappings } from "./reviseMappings";

export const approveColumnMappingStep = createStep({
  id: "approve-column-mapping-step",
  inputSchema: z.object({
    mappingResults: mappingResultsSchema,
    templateColumns: templateColumnsSchema,
    headerRow: z.array(z.string()),
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
    const {
      mappingResults,
      templateColumns,
      headerRow,
      startedAt,
      totalTemplateColumns,
      _runMetrics,
    } = inputData;

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

    let approvedMappings = mappingResults;

    if (action === "revise") {
      const revision = reviseMappings({
        proposed: mappingResults,
        corrections: resumeData.correctedMappings,
        templateColumns,
        headerRow,
      });

      if (!revision.ok) {
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
          reason: `Invalid column mapping revision: ${revision.errors.join("; ")}`,
        });
      }

      approvedMappings = revision.mappings;
    }

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
