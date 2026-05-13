import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { analyzeCsvStep } from "./steps/analyze-csv-step";
import { templateSchema } from "./steps/shared/schemas/templateSchema";
import { proposeFieldMappingStep } from "./steps/propose-field-mapping-step";
import { rowsSchema, rowSchema } from "./steps/shared/schemas/rowsSchema";

export const csvFieldMapperWorkflow = createWorkflow({
  id: "csv-field-mapper-workflow",
  inputSchema: z.object({
    filePath: z.string().nonempty(),
    template: templateSchema,
  }),
  outputSchema: z.object({
    headerRow: rowSchema,
    sampleRows: rowsSchema,
    totalRows: z.number(),
    error: z.string().optional(),
  }),
});

csvFieldMapperWorkflow
  .map(async ({ inputData }) => ({
    filePath: inputData.filePath,
    maxFileSize: inputData.template.maxFileSize,
  }))
  .then(analyzeCsvStep)
  .map(async ({ inputData, getInitData }) => ({
    headerRow: inputData.headerRow,
    sampleRows: inputData.sampleRows,
    templateColumns: getInitData<{
      filePath: string;
      template: z.infer<typeof templateSchema>;
    }>().template.columns,
    aliasDictionary: getInitData<{
      filePath: string;
      template: z.infer<typeof templateSchema>;
    }>().template.aliasDictionary,
  }))
  .then(proposeFieldMappingStep)
  .commit();
