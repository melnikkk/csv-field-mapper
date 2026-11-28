import { createStep } from "@mastra/core/workflows";
import { readFile, stat } from "fs/promises";
import Papa from "papaparse";
import { z } from "zod";
import { recordMetrics } from "../../../metrics/record";
import { resolveInputFilePath } from "../../shared/utils/resolveInputFilePath";
import {
  DUPLICATE_HEADERS_PREFIX,
  EMPTY_FILE,
  FILE_OUTSIDE_INPUT_DIR,
  FILE_NOT_UTF8,
  FILE_TOO_LARGE,
  SAMPLE_ROW_COUNT,
} from "./constants";
import { findDuplicateHeaders } from "./utils";

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

    const resolvedFilePath = await resolveInputFilePath(filePath);

    if (resolvedFilePath === undefined) {
      return bailWithReason(FILE_OUTSIDE_INPUT_DIR);
    }

    const { size } = await stat(resolvedFilePath);

    if (size > maxFileSize) {
      return bailWithReason(FILE_TOO_LARGE);
    }

    const content = await readFile(resolvedFilePath, "utf-8");

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

    const duplicates = findDuplicateHeaders(headerRow);

    if (duplicates.length > 0) {
      return bailWithReason(
        `${DUPLICATE_HEADERS_PREFIX}${duplicates.join(", ")}`,
      );
    }

    return {
      headerRow,
      sampleRows: dataRows.slice(0, SAMPLE_ROW_COUNT),
      totalRows: dataRows.length,
    };
  },
});
