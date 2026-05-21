import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { analyzeCsvStep } from "./steps/analyze-csv-step";
import {
  templateSchema,
  Template,
} from "./steps/shared/schemas/templateSchema";
import { proposeFieldMappingStep } from "./steps/propose-field-mapping-step";
import { approveFieldMappingStep } from "./steps/apply-field-mapping-step";
import { mapApprovedFieldsStep } from "./steps/apply-field-mapping-step";

export const csvFieldMapperWorkflow = createWorkflow({
  id: "csv-field-mapper-workflow",
  inputSchema: z.object({
    filePath: z.string().nonempty(),
    template: templateSchema,
  }),
  outputSchema: z.object({
    outputFilePath: z.string().optional(),
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
      template: Template;
    }>().template.columns,
    aliasDictionary: getInitData<{
      filePath: string;
      template: Template;
    }>().template.aliasDictionary,
  }))
  .then(proposeFieldMappingStep)
  .then(approveFieldMappingStep)
  .map(async ({ inputData, getInitData }) => ({
    filePath: getInitData<{ filePath: string }>().filePath,
    aborted: inputData.aborted,
    approvedMappings: inputData.approvedMappings,
  }))
  .then(mapApprovedFieldsStep)
  .commit();
