import { writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { RunMetrics } from "./schemas";
import { MAX_EXPECTED_HITL, TOKEN_BUDGET } from "./constants";

export function computeScores(metrics: RunMetrics): {
  mappingAccuracy: number;
  efficiency: number;
  hitlBurden: number;
} {
  const { totalTemplateColumns, aliasDictMapped, llmMapped, avgLlmConfidence } =
    metrics.accuracy.columnMapping;
  const mappedRatio =
    totalTemplateColumns > 0
      ? (aliasDictMapped + llmMapped) / totalTemplateColumns
      : 0;
  const confidenceBonus = avgLlmConfidence != null ? avgLlmConfidence * 0.1 : 0;
  const mappingAccuracy = Math.min(1, mappedRatio + confidenceBonus);

  const { totalInputTokens, totalOutputTokens } = metrics.efficiency;
  const efficiency = Math.max(
    0,
    1 - (totalInputTokens + totalOutputTokens) / TOKEN_BUDGET,
  );

  const {
    columnMappingApprovalTriggered,
    columnMappingRevisionCount,
    cellValueFixesApprovalTriggered,
  } = metrics.hitl;
  const suspensions =
    (columnMappingApprovalTriggered ? 1 : 0) +
    (cellValueFixesApprovalTriggered ? 1 : 0);
  const hitlBurden = Math.max(
    0,
    1 - (suspensions + columnMappingRevisionCount) / MAX_EXPECTED_HITL,
  );

  return { mappingAccuracy, efficiency, hitlBurden };
}

export async function writeMetricsReport(
  metrics: RunMetrics,
  outputFilePath: string,
): Promise<string> {
  const scores = computeScores(metrics);
  const { runId, timestamp, implementation, ...rest } = metrics;
  const report = { runId, timestamp, implementation, scores, metrics: rest };
  const metricsFilePath = join(
    dirname(outputFilePath),
    `csv-mapper-metrics-${runId}.json`,
  );
  await writeFile(metricsFilePath, JSON.stringify(report, null, 2), "utf-8");
  return metricsFilePath;
}
