import { createScorer } from "@mastra/core/evals";
import { z } from "zod";
import { runMetricsSchema } from "../schemas";
import { computeScores } from "../report";

export const efficiencyScorer = createScorer({
  id: "efficiency",
  description: "Scores token efficiency — penalises unnecessary LLM calls",
  type: {
    input: z.undefined(),
    output: runMetricsSchema,
  },
}).generateScore(({ run }) => computeScores(run.output).efficiency);
