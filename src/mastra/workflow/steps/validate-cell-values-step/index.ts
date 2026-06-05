import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getOutputsDirPath } from "../../shared/utils/getOutputsDirPath";
import Papa from "papaparse";
import { templateColumnsSchema } from "../../shared/schemas/templateSchema";
import {
  cellValidationResultsSchema,
  type CellValidationResults,
} from "../../shared/schemas/validationSchema";
import { applyFixer, runValidators } from "./utils";
import { CellValueValidationStatus } from "./constants";
import { mappingResultsSchema } from "../../shared/schemas/mappingSchema";
import { runMetricsAccumulatorSchema } from "../../../metrics/schemas";

export const validateCellValuesStep = createStep({
  id: "validate-cell-values-step",
  inputSchema: z.object({
    mappedFilePath: z.string(),
    templateColumns: templateColumnsSchema,
    approvedMappings: mappingResultsSchema,
    _runMetrics: runMetricsAccumulatorSchema.optional(),
  }),
  outputSchema: z.object({
    validatedFilePath: z.string(),
    autoFixed: cellValidationResultsSchema,
    needsReview: cellValidationResultsSchema,
    approvedMappings: mappingResultsSchema,
    _runMetrics: runMetricsAccumulatorSchema.optional(),
  }),
  execute: async ({ inputData }) => {
    const { mappedFilePath, templateColumns, approvedMappings } = inputData;

    const content = await readFile(mappedFilePath, "utf-8");
    const { data } = Papa.parse<Array<string>>(content, {
      header: false,
      skipEmptyLines: true,
    });

    await rm(mappedFilePath, { force: true });

    const [headers = [], ...dataRows] = data;
    const templateColumnByTitle = new Map(
      templateColumns.map((col) => [col.title, col]),
    );
    const outputRows = dataRows.map((row) => [...row]);
    const autoFixed: CellValidationResults = [];
    const needsReview: CellValidationResults = [];

    for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
      const column = templateColumnByTitle.get(headers[columnIndex]);

      if (!column?.validators?.length) {
        continue;
      }

      const { validators, fixerStrategy } = column;

      for (let rowIndex = 0; rowIndex < outputRows.length; rowIndex++) {
        const originalValue = outputRows[rowIndex][columnIndex] ?? "";
        const failedRules = runValidators(originalValue, validators);

        if (failedRules.length === 0) {
          continue;
        }

        if (fixerStrategy) {
          const fixedValue = applyFixer(originalValue, fixerStrategy);

          if (runValidators(fixedValue, validators).length === 0) {
            outputRows[rowIndex][columnIndex] = fixedValue;
            autoFixed.push({
              rowIndex: rowIndex,
              columnTitle: headers[columnIndex],
              originalValue,
              fixedValue,
              status: CellValueValidationStatus.AUTO_FIXED,
              failedRules,
            });

            continue;
          }
        }

        needsReview.push({
          rowIndex: rowIndex,
          columnTitle: headers[columnIndex],
          originalValue,
          status: CellValueValidationStatus.NEEDS_REVIEW,
          failedRules,
        });
      }
    }

    const outputsDir = getOutputsDirPath();
    await mkdir(outputsDir, { recursive: true });
    const validatedFilePath = join(
      outputsDir,
      `csv-mapper-validated-${randomUUID()}.csv`,
    );

    await writeFile(
      validatedFilePath,
      Papa.unparse([headers, ...outputRows]),
      "utf-8",
    );

    return {
      validatedFilePath,
      autoFixed,
      needsReview,
      approvedMappings,
      _runMetrics: {
        ...inputData._runMetrics,
        cellValidationCounts: {
          autoFixedCount: autoFixed.length,
          needsReviewCount: needsReview.length,
        },
      },
    };
  },
});
