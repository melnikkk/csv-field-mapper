import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { csvFieldMapperWorkflow } from "./workflow";
import { mappingAccuracyScorer } from "./metrics/scorers/mappingAccuracy";
import { efficiencyScorer } from "./metrics/scorers/efficiency";
import { hitlBurdenScorer } from "./metrics/scorers/hitlBurden";

export const mastra = new Mastra({
  workflows: { csvFieldMapperWorkflow },
  storage: new LibSQLStore({ id: "csv-field-mapper", url: "file:./mastra.db" }),
  scorers: {
    mappingAccuracy: mappingAccuracyScorer,
    efficiency: efficiencyScorer,
    hitlBurden: hitlBurdenScorer,
  },
});
