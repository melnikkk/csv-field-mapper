import { z } from "zod";

export const runMetricsAccumulatorSchema = z.object({
  columnMappingLlm: z
    .object({
      aliasDictMapped: z.number(),
      llmMapped: z.number(),
      unmapped: z.number(),
      avgLlmConfidence: z.number().nullable(),
      llmCalled: z.boolean(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      durationMs: z.number(),
    })
    .optional(),
  approveMappingHitl: z
    .object({
      suspended: z.boolean(),
      revisionCount: z.number(),
    })
    .optional(),
  cellValidationCounts: z
    .object({
      autoFixedCount: z.number(),
      needsReviewCount: z.number(),
    })
    .optional(),
  cellFixesLlm: z
    .object({
      llmCalled: z.boolean(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      durationMs: z.number(),
    })
    .optional(),
  approveCellFixesHitl: z
    .object({
      suspended: z.boolean(),
    })
    .optional(),
});

export const runMetricsSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  implementation: z.enum(["workflow", "agent"]),
  accuracy: z.object({
    columnMapping: z.object({
      totalTemplateColumns: z.number(),
      aliasDictMapped: z.number(),
      llmMapped: z.number(),
      unmapped: z.number(),
      avgLlmConfidence: z.number().nullable(),
    }),
    cellValidation: z.object({
      totalCellsChecked: z.number(),
      autoFixed: z.number(),
      llmFixed: z.number(),
      unresolved: z.number(),
    }),
  }),
  efficiency: z.object({
    totalDurationMs: z.number(),
    llmCalls: z.object({
      columnMapping: z
        .object({
          called: z.boolean(),
          inputTokens: z.number(),
          outputTokens: z.number(),
          durationMs: z.number(),
        })
        .nullable(),
      cellValueFixes: z
        .object({
          called: z.boolean(),
          inputTokens: z.number(),
          outputTokens: z.number(),
          durationMs: z.number(),
        })
        .nullable(),
    }),
    totalInputTokens: z.number(),
    totalOutputTokens: z.number(),
  }),
  hitl: z.object({
    columnMappingApprovalTriggered: z.boolean(),
    columnMappingRevisionCount: z.number(),
    cellValueFixesApprovalTriggered: z.boolean(),
  }),
});

export type RunMetrics = z.infer<typeof runMetricsSchema>;
