import { createStep } from "@mastra/core/workflows";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import Papa from "papaparse";
import { z } from "zod";
import { getOutputsDirPath } from "../shared/utils/getOutputsDirPath";
import { cellValidationResultsSchema } from "../shared/schemas/validationSchema";

export const applyCellValuesFixesStep = createStep({
  id: "apply-cell-values-fixes-step",
  inputSchema: z.object({
    approvedFixes: cellValidationResultsSchema,
    validatedFilePath: z.string(),
  }),
  outputSchema: z.object({ outputFilePath: z.string() }),
  execute: async ({ inputData }) => {
    const { approvedFixes, validatedFilePath } = inputData;

    const applicableFixes = approvedFixes.filter(
      (fix) => fix.fixedValue !== undefined,
    );

    if (applicableFixes.length === 0) {
      return { outputFilePath: validatedFilePath };
    }

    const content = await readFile(validatedFilePath, "utf-8");
    const { data } = Papa.parse<Array<string>>(content, {
      header: false,
      skipEmptyLines: true,
    });

    const [headers = [], ...dataRows] = data;
    const outputRows = dataRows.map((row) => [...row]);
    const headerIndex = new Map(headers.map((header, i) => [header, i]));

    for (const fix of applicableFixes) {
      const colIdx = headerIndex.get(fix.columnTitle);

      if (colIdx !== undefined && fix.rowIndex < outputRows.length) {
        outputRows[fix.rowIndex][colIdx] = fix.fixedValue!;
      }
    }

    await rm(validatedFilePath, { force: true });

    const outputsDir = getOutputsDirPath();
    await mkdir(outputsDir, { recursive: true });
    const outputFilePath = join(
      outputsDir,
      `csv-mapper-final-${randomUUID()}.csv`,
    );

    await writeFile(
      outputFilePath,
      Papa.unparse([headers, ...outputRows]),
      "utf-8",
    );

    return { outputFilePath };
  },
});
