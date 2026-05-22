import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { analyzeCsvStep } from "./steps/analyze-csv-step";
import {
  templateSchema,
  Template,
} from "./steps/shared/schemas/templateSchema";
import { proposeColumnMappingStep } from "./steps/propose-column-mapping-step";
import { approveColumnMappingStep } from "./steps/approve-column-mapping-step";
import { applyColumnMappingStep } from "./steps/apply-column-mapping-step";
import { validateCellValuesStep } from "./steps/validate-cell-values-step";
import { proposeCellValuesFixesStep } from "./steps/propose-cell-values-fixes-step";

export const csvFieldMapperWorkflow = createWorkflow({
  id: "csv-field-mapper-workflow",
  inputSchema: z.object({
    filePath: z.string().nonempty(),
    template: templateSchema,
  }),
  outputSchema: z.object({
    outputFilePath: z.string(),
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
  .then(proposeColumnMappingStep)
  .then(approveColumnMappingStep)
  .map(async ({ inputData, getInitData }) => ({
    filePath: getInitData<{ filePath: string }>().filePath,
    approvedMappings: inputData.approvedMappings,
  }))
  .then(applyColumnMappingStep)
  .map(async ({ inputData, getInitData }) => ({
    mappedFilePath: inputData.mappedFilePath,
    templateColumns: getInitData<{ template: Template }>().template.columns,
  }))
  .then(validateCellValuesStep)
  .map(async ({ inputData, getInitData }) => ({
    needsReview: inputData.needsReview,
    validatedFilePath: inputData.validatedFilePath,
    templateColumns: getInitData<{ template: Template }>().template.columns,
  }))
  .then(proposeCellValuesFixesStep)
  .commit();
