import { createScorer } from "@mastra/core/evals";
import { z } from "zod";
import { runMetricsSchema } from "../schemas";
import { computeScores } from "../report";

export const mappingAccuracyScorer = createScorer({
  id: "mapping-accuracy",
  description:
    "Scores how accurately CSV columns were mapped to template columns",
  type: {
    input: z.undefined(),
    output: runMetricsSchema,
  },
}).generateScore(({ run }) => computeScores(run.output).mappingAccuracy);
