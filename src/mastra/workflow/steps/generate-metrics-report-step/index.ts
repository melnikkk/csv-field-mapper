import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { cellValidationResultsSchema } from "../../shared/schemas/validationSchema";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";
import { recordMetrics } from "../../../metrics/record";
import { cleanupIntermediateFiles } from "../../shared/utils/cleanupIntermediateFiles";

export const generateMetricsReportStep = createStep({
  id: "generate-metrics-report-step",
  inputSchema: z.object({
    outputFilePath: z.string(),
    autoFixed: cellValidationResultsSchema,
    appliedFixes: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
    startedAt: z.string(),
    totalTemplateColumns: z.number(),
    intermediateFilePaths: z.array(z.string().optional()),
    _runMetrics: runMetricsAccumulatorSchema.optional(),
  }),
  outputSchema: z.object({
    outputFilePath: z.string(),
    metricsFilePath: z.string(),
    autoFixed: cellValidationResultsSchema,
    appliedFixes: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
  }),
  execute: async ({ inputData, mastra, runId }) => {
    const {
      outputFilePath,
      autoFixed,
      appliedFixes,
      approvedMappings,
      startedAt,
      totalTemplateColumns,
      intermediateFilePaths,
      _runMetrics,
    } = inputData;

    const metricsFilePath = await recordMetrics({
      outputFilePath,
      autoFixed,
      appliedFixes,
      startedAt,
      totalTemplateColumns,
      _runMetrics,
      mastra,
      workflowRunId: runId,
    });

    await cleanupIntermediateFiles(
      intermediateFilePaths.filter((path) => path !== outputFilePath),
    );

    return {
      outputFilePath,
      metricsFilePath,
      autoFixed,
      appliedFixes,
      approvedMappings,
    };
  },
});
