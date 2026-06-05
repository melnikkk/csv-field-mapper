import { describe, expect, it, mock, beforeEach } from "bun:test";

const mockWriteMetricsReport = mock((metrics: any, outputFilePath: string) =>
  Promise.resolve(
    outputFilePath.replace(/\/[^/]+$/, "/csv-mapper-metrics-test.json"),
  ),
);

mock.module("../../../../metrics/report", () => ({
  writeMetricsReport: mockWriteMetricsReport,
  computeScores: () => ({
    mappingAccuracy: 0.9,
    efficiency: 0.8,
    hitlBurden: 1.0,
  }),
}));

mock.module("../../../../metrics/scorers/mappingAccuracy", () => ({
  mappingAccuracyScorer: { run: mock(() => Promise.resolve({ score: 0.9 })) },
}));
mock.module("../../../../metrics/scorers/efficiency", () => ({
  efficiencyScorer: { run: mock(() => Promise.resolve({ score: 0.8 })) },
}));
mock.module("../../../../metrics/scorers/hitlBurden", () => ({
  hitlBurdenScorer: { run: mock(() => Promise.resolve({ score: 1.0 })) },
}));

import { generateMetricsReportStep } from "../index";

const baseInput = {
  outputFilePath: "/outputs/csv-mapper-final-abc.csv",
  autoFixed: [],
  appliedFixes: [],
  approvedMappings: [
    {
      templateColumn: { title: "First Name", required: true },
      csvHeader: "first_name",
      confidence: 1,
    },
    {
      templateColumn: { title: "Last Name", required: true },
      csvHeader: "last_name",
      confidence: 1,
    },
  ],
  startedAt: new Date(Date.now() - 3000).toISOString(),
  totalTemplateColumns: 2,
  _runMetrics: {
    columnMappingLlm: {
      aliasDictMapped: 2,
      llmMapped: 0,
      unmapped: 0,
      avgLlmConfidence: null,
      llmCalled: false,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    },
    approveMappingHitl: { suspended: false, revisionCount: 0 },
    cellValidationCounts: { autoFixedCount: 0, needsReviewCount: 0 },
    cellFixesLlm: {
      llmCalled: false,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    },
    approveCellFixesHitl: { suspended: false },
  },
};

const execute = (inputData: typeof baseInput) =>
  (generateMetricsReportStep as any).execute({ inputData });

describe("generateMetricsReportStep", () => {
  beforeEach(() => {
    mockWriteMetricsReport.mockClear();
  });

  it("calls writeMetricsReport and returns the metrics file path", async () => {
    const result = await execute(baseInput);
    expect(mockWriteMetricsReport).toHaveBeenCalledTimes(1);
    const [metricsArg, pathArg] = mockWriteMetricsReport.mock.calls[0];
    expect(pathArg).toBe(baseInput.outputFilePath);
    expect(metricsArg.implementation).toBe("workflow");
    expect(metricsArg).toHaveProperty("runId");
    expect(metricsArg).toHaveProperty("accuracy");
    expect(metricsArg).toHaveProperty("efficiency");
    expect(metricsArg).toHaveProperty("hitl");
    expect(result.metricsFilePath).toContain("csv-mapper-metrics-");
  });

  it("returns the original outputFilePath and mappings unchanged", async () => {
    const result = await execute(baseInput);
    expect(result.outputFilePath).toBe(baseInput.outputFilePath);
    expect(result.approvedMappings).toEqual(baseInput.approvedMappings);
    expect(result.autoFixed).toEqual(baseInput.autoFixed);
    expect(result.appliedFixes).toEqual(baseInput.appliedFixes);
  });
});
