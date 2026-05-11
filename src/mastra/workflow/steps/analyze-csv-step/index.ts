import { createStep } from "@mastra/core/workflows";
import { readFile, stat } from "fs/promises";
import Papa from "papaparse";
import { z } from "zod";
import { FILE_TOO_LARGE, SAMPLE_ROW_COUNT } from "./constants";

export const analyzeCsvStep = createStep({
  id: "analyze-csv",
  inputSchema: z.object({
    filePath: z.string().nonempty(),
    maxFileSize: z.number().positive(),
  }),
  outputSchema: z.object({
    headerRow: z.array(z.string()),
    sampleRows: z.array(z.array(z.string())),
    totalRows: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData, bail }) => {
    const { size } = await stat(inputData.filePath);

    if (size > inputData.maxFileSize) {
      return bail({
        headerRow: [],
        sampleRows: [],
        totalRows: 0,
        error: FILE_TOO_LARGE,
      });
    }

    const content = await readFile(inputData.filePath, "utf-8");

    if (content.includes("\uFFFD")) {
      return bail({
        headerRow: [],
        sampleRows: [],
        totalRows: 0,
        error: "File encoding is not UTF-8",
      });
    }

    const { data } = Papa.parse<Array<string>>(content, {
      header: false,
      skipEmptyLines: true,
    });

    const [headerRow = [], ...dataRows] = data;

    return {
      headerRow,
      sampleRows: dataRows.slice(0, SAMPLE_ROW_COUNT),
      totalRows: dataRows.length,
    };
  },
});
