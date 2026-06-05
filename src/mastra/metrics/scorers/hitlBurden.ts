import { createScorer } from "@mastra/core/evals";
import { z } from "zod";
import { runMetricsSchema } from "../schemas";
import { computeScores } from "../report";

export const hitlBurdenScorer = createScorer({
  id: "hitl-burden",
  description:
    "Scores human-in-the-loop cost — higher means less manual intervention needed",
  type: {
    input: z.undefined(),
    output: runMetricsSchema,
  },
}).generateScore(({ run }) => computeScores(run.output).hitlBurden);
