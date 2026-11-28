import { createStep } from "@mastra/core/workflows";
import { readFile, stat } from "fs/promises";
import Papa from "papaparse";
import { z } from "zod";
import { recordMetrics } from "../../../metrics/record";
import {
  EMPTY_FILE,
  FILE_NOT_UTF8,
  FILE_TOO_LARGE,
  SAMPLE_ROW_COUNT,
} from "./constants";

export const analyzeCsvStep = createStep({
  id: "analyze-csv",
  inputSchema: z.object({
    filePath: z.string().nonempty(),
    maxFileSize: z.number().positive(),
    startedAt: z.string(),
    totalTemplateColumns: z.number(),
  }),
  outputSchema: z.object({
    headerRow: z.array(z.string()),
    sampleRows: z.array(z.array(z.string())),
    totalRows: z.number(),
  }),
  execute: async ({ inputData, bail, mastra, runId }) => {
    const { filePath, maxFileSize, startedAt, totalTemplateColumns } =
      inputData;

    const bailWithReason = async (reason: string) => {
      await recordMetrics({
        startedAt,
        totalTemplateColumns,
        mastra,
        workflowRunId: runId,
      });
      return bail({ reason });
    };

    const { size } = await stat(filePath);

    if (size > maxFileSize) {
      return bailWithReason(FILE_TOO_LARGE);
    }

    const content = await readFile(filePath, "utf-8");

    if (content.includes("�")) {
      return bailWithReason(FILE_NOT_UTF8);
    }

    const { data } = Papa.parse<Array<string>>(content, {
      header: false,
      skipEmptyLines: true,
    });

    if (data.length === 0) {
      return bailWithReason(EMPTY_FILE);
    }

    const [headerRow, ...dataRows] = data;

    return {
      headerRow,
      sampleRows: dataRows.slice(0, SAMPLE_ROW_COUNT),
      totalRows: dataRows.length,
    };
  },
});
