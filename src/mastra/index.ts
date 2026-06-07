import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { DuckDBStore } from "@mastra/duckdb";
import { csvFieldMapperWorkflow } from "./workflow";
import { mappingAccuracyScorer } from "./metrics/scorers/mappingAccuracy";
import { efficiencyScorer } from "./metrics/scorers/efficiency";
import { hitlBurdenScorer } from "./metrics/scorers/hitlBurden";

const storage = new LibSQLStore({
  id: "csv-field-mapper",
  url: "file:./mastra.db",
});
const duckdb = new DuckDBStore({ id: "csv-field-mapper-obs" });
// ObservabilityLibSQL (used by LibSQLStore) does not implement metric aggregation queries.
// Swap in DuckDB's observability store which has full support.
storage.stores.observability = duckdb.observability;

export const mastra = new Mastra({
  workflows: { csvFieldMapperWorkflow },
  storage,
  scorers: {
    mappingAccuracy: mappingAccuracyScorer,
    efficiency: efficiencyScorer,
    hitlBurden: hitlBurdenScorer,
  },
});
