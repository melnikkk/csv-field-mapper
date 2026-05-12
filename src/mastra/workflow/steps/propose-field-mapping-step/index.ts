import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import {
  templateColumnsSchema,
  aliasDictionarySchema,
} from "../shared/schemas/templateSchema";
import { mappingResultSchema } from "./schema";
import { mapColumnsBasedOnDictionary } from "./utils";

export const proposeFieldMappingStep = createStep({
  id: "propose-field-mapping",
  inputSchema: z.object({
    headerRow: z.array(z.string()),
    templateColumns: templateColumnsSchema,
    aliasDictionary: aliasDictionarySchema.optional(),
  }),
  outputSchema: z.object({
    mappingResults: z.array(mappingResultSchema),
  }),
  execute: async ({ inputData }) => {
    const mappingResults = mapColumnsBasedOnDictionary(
      inputData.headerRow,
      inputData.templateColumns,
      inputData.aliasDictionary,
    );

    return { mappingResults };
  },
});
