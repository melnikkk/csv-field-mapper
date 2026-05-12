import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { analyzeCsvStep } from "./steps/analyze-csv-step";
import { templateSchema } from "./steps/shared/schemas/templateSchema";
import { proposeFieldMappingStep } from "./steps/propose-field-mapping-step";

export const csvFieldMapperWorkflow = createWorkflow({
  id: "csv-field-mapper-workflow",
  inputSchema: z.object({
    filePath: z.string().nonempty(),
    template: templateSchema,
  }),
  outputSchema: z.object({
    headerRow: z.array(z.string()),
    sampleRows: z.array(z.array(z.string())),
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
