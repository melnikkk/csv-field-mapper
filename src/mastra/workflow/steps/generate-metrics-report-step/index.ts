import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { randomUUID } from "crypto";
import { cellValidationResultsSchema } from "../../shared/schemas/validationSchema";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import {
  runMetricsAccumulatorSchema,
  runMetricsSchema,
  type RunMetrics,
} from "../../../metrics/schemas";
import { writeMetricsReport } from "../../../metrics/report";
import { mappingAccuracyScorer } from "../../../metrics/scorers/mappingAccuracy";
import { efficiencyScorer } from "../../../metrics/scorers/efficiency";
import { hitlBurdenScorer } from "../../../metrics/scorers/hitlBurden";

export const generateMetricsReportStep = createStep({
  id: "generate-metrics-report-step",
  inputSchema: z.object({
    outputFilePath: z.string(),
    autoFixed: cellValidationResultsSchema,
    appliedFixes: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
    startedAt: z.string(),
    totalTemplateColumns: z.number(),
    _runMetrics: runMetricsAccumulatorSchema.optional(),
  }),
  outputSchema: z.object({
    outputFilePath: z.string(),
    metricsFilePath: z.string(),
    autoFixed: cellValidationResultsSchema,
    appliedFixes: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
  }),
  execute: async ({ inputData }) => {
    const {
      outputFilePath,
      autoFixed,
      appliedFixes,
      approvedMappings,
      startedAt,
      totalTemplateColumns,
      _runMetrics,
    } = inputData;

    const runId = randomUUID();
    const totalDurationMs = Date.now() - new Date(startedAt).getTime();

    const col = _runMetrics?.columnMappingLlm;
    const cellCounts = _runMetrics?.cellValidationCounts;
    const cellFixes = _runMetrics?.cellFixesLlm;
    const approvMapping = _runMetrics?.approveMappingHitl;
    const approvCellFixes = _runMetrics?.approveCellFixesHitl;

    const totalInputTokens =
      (col?.inputTokens ?? 0) + (cellFixes?.inputTokens ?? 0);
    const totalOutputTokens =
      (col?.outputTokens ?? 0) + (cellFixes?.outputTokens ?? 0);

    const llmFixed = appliedFixes.length;
    const autoFixedCount = cellCounts?.autoFixedCount ?? autoFixed.length;
    const needsReviewCount = cellCounts?.needsReviewCount ?? 0;
    const unresolved = Math.max(0, needsReviewCount - llmFixed);
    const totalCellsChecked = autoFixedCount + needsReviewCount;

    const runMetrics: RunMetrics = {
      runId,
      timestamp: new Date().toISOString(),
      implementation: "workflow",
      accuracy: {
        columnMapping: {
          totalTemplateColumns,
          aliasDictMapped: col?.aliasDictMapped ?? 0,
          llmMapped: col?.llmMapped ?? 0,
          unmapped: col?.unmapped ?? 0,
          avgLlmConfidence: col?.avgLlmConfidence ?? null,
        },
        cellValidation: {
          totalCellsChecked,
          autoFixed: autoFixedCount,
          llmFixed,
          unresolved,
        },
      },
      efficiency: {
        totalDurationMs,
        llmCalls: {
          columnMapping:
            col != null
              ? {
                  called: col.llmCalled,
                  inputTokens: col.inputTokens,
                  outputTokens: col.outputTokens,
                  durationMs: col.durationMs,
                }
              : null,
          cellValueFixes:
            cellFixes != null
              ? {
                  called: cellFixes.llmCalled,
                  inputTokens: cellFixes.inputTokens,
                  outputTokens: cellFixes.outputTokens,
                  durationMs: cellFixes.durationMs,
                }
              : null,
        },
        totalInputTokens,
        totalOutputTokens,
      },
      hitl: {
        columnMappingApprovalTriggered: approvMapping?.suspended ?? false,
        columnMappingRevisionCount: approvMapping?.revisionCount ?? 0,
        cellValueFixesApprovalTriggered: approvCellFixes?.suspended ?? false,
      },
    };

    runMetricsSchema.parse(runMetrics);

    const metricsFilePath = await writeMetricsReport(
      runMetrics,
      outputFilePath,
    );

    await Promise.all([
      mappingAccuracyScorer.run({ output: runMetrics, runId }),
      efficiencyScorer.run({ output: runMetrics, runId }),
      hitlBurdenScorer.run({ output: runMetrics, runId }),
    ]);

    return {
      outputFilePath,
      metricsFilePath,
      autoFixed,
      appliedFixes,
      approvedMappings,
    };
  },
});
