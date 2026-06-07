import { randomUUID } from "crypto";
import { join } from "path";
import type { Mastra } from "@mastra/core";
import type { CellValidationResults } from "../workflow/shared/schemas/validationSchema";
import type { RunMetricsAccumulator } from "./schemas";
import { runMetricsSchema, type RunMetrics } from "./schemas";
import { writeMetricsReport } from "./report";
import { mappingAccuracyScorer } from "./scorers/mappingAccuracy";
import { efficiencyScorer } from "./scorers/efficiency";
import { hitlBurdenScorer } from "./scorers/hitlBurden";
import { getOutputsDirPath } from "../workflow/shared/utils/getOutputsDirPath";

const WORKFLOW_ID = "csvFieldMapperWorkflow";

interface RecordMetricsInput {
  outputFilePath?: string;
  autoFixed?: CellValidationResults;
  appliedFixes?: CellValidationResults;
  startedAt: string;
  totalTemplateColumns: number;
  _runMetrics?: RunMetricsAccumulator;
  mastra?: Mastra;
  workflowRunId?: string;
}

export async function recordMetrics(
  input: RecordMetricsInput,
): Promise<string> {
  const {
    outputFilePath,
    autoFixed = [],
    appliedFixes = [],
    startedAt,
    totalTemplateColumns,
    _runMetrics,
    mastra,
    workflowRunId,
  } = input;

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

  const resolvedOutputFilePath =
    outputFilePath ?? join(getOutputsDirPath(), "abort.csv");
  const metricsFilePath = await writeMetricsReport(
    runMetrics,
    resolvedOutputFilePath,
  );

  const [accuracyResult, efficiencyResult, hitlResult] = await Promise.all([
    mappingAccuracyScorer.run({ output: runMetrics, runId }),
    efficiencyScorer.run({ output: runMetrics, runId }),
    hitlBurdenScorer.run({ output: runMetrics, runId }),
  ]);

  if (mastra) {
    const scoresStore = await mastra.getStorage()?.getStore("scores");
    if (scoresStore?.saveScore) {
      const basePayload = {
        runId: workflowRunId ?? runId,
        entityId: WORKFLOW_ID,
        entityType: "WORKFLOW" as const,
        output: runMetrics,
        source: "LIVE" as const,
        entity: { id: WORKFLOW_ID },
        scorer: { id: "", name: "" },
      };
      await Promise.all([
        scoresStore.saveScore({
          ...basePayload,
          scorerId: mappingAccuracyScorer.id,
          scorer: {
            id: mappingAccuracyScorer.id,
            name: mappingAccuracyScorer.name,
          },
          score: accuracyResult.score ?? 0,
        }),
        scoresStore.saveScore({
          ...basePayload,
          scorerId: efficiencyScorer.id,
          scorer: { id: efficiencyScorer.id, name: efficiencyScorer.name },
          score: efficiencyResult.score ?? 0,
        }),
        scoresStore.saveScore({
          ...basePayload,
          scorerId: hitlBurdenScorer.id,
          scorer: { id: hitlBurdenScorer.id, name: hitlBurdenScorer.name },
          score: hitlResult.score ?? 0,
        }),
      ]);
    }
  }

  return metricsFilePath;
}
