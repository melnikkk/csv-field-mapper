import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { csvFieldMapperWorkflow } from "./workflow";

export const mastra = new Mastra({
  workflows: { csvFieldMapperWorkflow },
  storage: new LibSQLStore({ id: "csv-field-mapper", url: "file:./mastra.db" }),
});
