import { describe, expect, it } from "bun:test";
import { computeScores } from "../report";
import type { RunMetrics } from "../schemas";

const baseMetrics: RunMetrics = {
  runId: "test-run",
  timestamp: "2026-06-05T00:00:00Z",
  implementation: "workflow",
  accuracy: {
    columnMapping: {
      totalTemplateColumns: 4,
      aliasDictMapped: 2,
      llmMapped: 2,
      unmapped: 0,
      avgLlmConfidence: 0.9,
    },
    cellValidation: {
      totalCellsChecked: 10,
      autoFixed: 2,
      llmFixed: 1,
      unresolved: 0,
    },
  },
  efficiency: {
    totalDurationMs: 3000,
    llmCalls: {
      columnMapping: {
        called: true,
        inputTokens: 500,
        outputTokens: 100,
        durationMs: 1000,
      },
      cellValueFixes: {
        called: true,
        inputTokens: 300,
        outputTokens: 80,
        durationMs: 800,
      },
    },
    totalInputTokens: 800,
    totalOutputTokens: 180,
  },
  hitl: {
    columnMappingApprovalTriggered: false,
    columnMappingRevisionCount: 0,
    cellValueFixesApprovalTriggered: false,
  },
};

describe("computeScores", () => {
  it("scores perfect mapping (all columns mapped with high confidence) as ~1", () => {
    const { mappingAccuracy } = computeScores(baseMetrics);
    expect(mappingAccuracy).toBeCloseTo(1.0, 1);
  });

  it("scores partial mapping proportionally", () => {
    const metrics: RunMetrics = {
      ...baseMetrics,
      accuracy: {
        ...baseMetrics.accuracy,
        columnMapping: {
          totalTemplateColumns: 4,
          aliasDictMapped: 2,
          llmMapped: 0,
          unmapped: 2,
          avgLlmConfidence: null,
        },
      },
    };
    const { mappingAccuracy } = computeScores(metrics);
    expect(mappingAccuracy).toBeCloseTo(0.5, 2);
  });

  it("scores zero total tokens as efficiency 1", () => {
    const metrics: RunMetrics = {
      ...baseMetrics,
      efficiency: {
        ...baseMetrics.efficiency,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      },
    };
    const { efficiency } = computeScores(metrics);
    expect(efficiency).toBe(1);
  });

  it("clamps efficiency to 0 when tokens exceed budget", () => {
    const metrics: RunMetrics = {
      ...baseMetrics,
      efficiency: {
        ...baseMetrics.efficiency,
        totalInputTokens: 8000,
        totalOutputTokens: 4000,
      },
    };
    const { efficiency } = computeScores(metrics);
    expect(efficiency).toBe(0);
  });

  it("scores zero HITL events as hitlBurden 1", () => {
    const { hitlBurden } = computeScores(baseMetrics);
    expect(hitlBurden).toBe(1);
  });

  it("reduces hitlBurden score for each suspension and revision", () => {
    const metrics: RunMetrics = {
      ...baseMetrics,
      hitl: {
        columnMappingApprovalTriggered: true,
        columnMappingRevisionCount: 1,
        cellValueFixesApprovalTriggered: true,
      },
    };
    const { hitlBurden } = computeScores(metrics);
    // suspensions=2, revisions=1, total=3, MAX_EXPECTED_HITL=5 → 1 - 3/5 = 0.4
    expect(hitlBurden).toBeCloseTo(0.4, 5);
  });
});
