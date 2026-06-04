import { createWorkflow } from "@mastra/core/workflows";
import { analyzeCsvStep } from "./steps/analyze-csv-step";
import { proposeColumnMappingStep } from "./steps/propose-column-mapping-step";
import { approveColumnMappingStep } from "./steps/approve-column-mapping-step";
import { applyColumnMappingStep } from "./steps/apply-column-mapping-step";
import { validateCellValuesStep } from "./steps/validate-cell-values-step";
import { proposeCellValuesFixesStep } from "./steps/propose-cell-values-fixes-step";
import { approveCellValuesFixesStep } from "./steps/approve-cell-values-fixes-step";
import { applyCellValuesFixesStep } from "./steps/apply-cell-values-fixes-step";
import {
  WorkflowInputData,
  workflowInputDataSchema,
} from "./shared/schemas/workflowInputSchema";
import { workflowOutputSchema } from "./shared/schemas/workflowOutputSchema";

export const csvFieldMapperWorkflow = createWorkflow({
  id: "csv-field-mapper-workflow",
  inputSchema: workflowInputDataSchema,
  outputSchema: workflowOutputSchema,
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
    templateColumns: getInitData<WorkflowInputData>().template.columns,
    aliasDictionary: getInitData<WorkflowInputData>().template.aliasDictionary,
  }))
  .then(proposeColumnMappingStep)
  .then(approveColumnMappingStep)
  .map(async ({ inputData, getInitData }) => ({
    filePath: getInitData<WorkflowInputData>().filePath,
    approvedMappings: inputData.approvedMappings,
  }))
  .then(applyColumnMappingStep)
  .map(async ({ inputData, getInitData }) => ({
    mappedFilePath: inputData.mappedFilePath,
    approvedMappings: inputData.approvedMappings,
    templateColumns: getInitData<WorkflowInputData>().template.columns,
  }))
  .then(validateCellValuesStep)
  .map(async ({ inputData, getInitData }) => ({
    needsReview: inputData.needsReview,
    autoFixed: inputData.autoFixed,
    approvedMappings: inputData.approvedMappings,
    validatedFilePath: inputData.validatedFilePath,
    templateColumns: getInitData<WorkflowInputData>().template.columns,
  }))
  .then(proposeCellValuesFixesStep)
  .then(approveCellValuesFixesStep)
  .then(applyCellValuesFixesStep)
  .commit();
