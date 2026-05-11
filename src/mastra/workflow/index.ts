import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { analyzeCsvStep } from "./steps/analyze-csv-step";

const templateColumnSchema = z.object({
  columnTitle: z.string(),
  required: z.boolean(),
});

const templateSchema = z.object({
  maxFileSize: z.number().positive(),
  columns: z.array(templateColumnSchema),
});

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
})
  .map(async ({ inputData }) => ({
    filePath: inputData.filePath,
    maxFileSize: inputData.template.maxFileSize,
  }))
  .then(analyzeCsvStep)
  .commit();
