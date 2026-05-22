import { z } from "zod";
import { createStep } from "@mastra/core/workflows";
import { readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import Papa from "papaparse";
import { templateColumnsSchema } from "../shared/schemas/templateSchema";
import {
  cellValidationResultsSchema,
  type CellValidationResult,
} from "../shared/schemas/validationSchema";
import { applyFixer, runValidators } from "./utils";

export const validateCellValuesStep = createStep({
  id: "validate-cell-values-step",
  inputSchema: z.object({
    mappedFilePath: z.string(),
    templateColumns: templateColumnsSchema,
  }),
  outputSchema: z.object({
    validatedFilePath: z.string(),
    autoFixed: cellValidationResultsSchema,
    needsReview: cellValidationResultsSchema,
  }),
  execute: async ({ inputData }) => {
    const { mappedFilePath, templateColumns } = inputData;

    const content = await readFile(mappedFilePath, "utf-8");
    const { data } = Papa.parse<Array<string>>(content, {
      header: false,
      skipEmptyLines: true,
    });

    await rm(mappedFilePath, { force: true });

    const [headers = [], ...dataRows] = data;
    const columnByTitle = new Map(
      templateColumns.map((col) => [col.title, col]),
    );
    const outputRows = dataRows.map((row) => [...row]);
    const autoFixed: CellValidationResult[] = [];
    const needsReview: CellValidationResult[] = [];

    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const column = columnByTitle.get(headers[colIdx]);

      if (!column?.validators?.length) {
        continue;
      }

      const { validators, fixerStrategy } = column;

      for (let rowIdx = 0; rowIdx < outputRows.length; rowIdx++) {
        const originalValue = outputRows[rowIdx][colIdx] ?? "";
        const failedRules = runValidators(originalValue, validators);

        if (failedRules.length === 0) {
          continue;
        }

        if (fixerStrategy) {
          const fixedValue = applyFixer(originalValue, fixerStrategy);

          if (runValidators(fixedValue, validators).length === 0) {
            outputRows[rowIdx][colIdx] = fixedValue;
            autoFixed.push({
              rowIndex: rowIdx,
              columnTitle: headers[colIdx],
              originalValue,
              fixedValue,
              status: "autoFixed",
              failedRules,
            });

            continue;
          }
        }

        needsReview.push({
          rowIndex: rowIdx,
          columnTitle: headers[colIdx],
          originalValue,
          status: "needsReview",
          failedRules,
        });
      }
    }

    const validatedFilePath = join(
      tmpdir(),
      `csv-mapper-validated-${randomUUID()}.csv`,
    );

    await writeFile(
      validatedFilePath,
      Papa.unparse([headers, ...outputRows]),
      "utf-8",
    );

    return { validatedFilePath, autoFixed, needsReview };
  },
});
