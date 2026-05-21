import { createStep } from "@mastra/core/workflows";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import Papa from "papaparse";
import { z } from "zod";
import { mappingResultsSchema } from "../shared/schemas/mappingSchema";
import { generateOutputFilePath } from "./utils";

export const mapApprovedFieldsStep = createStep({
  id: "apply-field-mapping-step",
  inputSchema: z.object({
    aborted: z.boolean(),
    filePath: z.string(),
    approvedMappings: mappingResultsSchema,
  }),
  outputSchema: z.object({
    outputFilePath: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { aborted, filePath, approvedMappings } = inputData;

    if (aborted) {
      return { outputFilePath: undefined };
    }

    const outputFilePath = generateOutputFilePath(filePath);

    await mkdir(dirname(outputFilePath), { recursive: true });

    const content = await readFile(filePath, "utf-8");
    const { data } = Papa.parse<Array<string>>(content, {
      header: false,
      skipEmptyLines: true,
    });

    const [headerRow = [], ...dataRows] = data;

    const headerIndex = new Map(headerRow.map((header, i) => [header, i]));

    const activeMappings = approvedMappings.filter(
      (mapping) => mapping.csvHeader !== undefined,
    );

    const outputHeaders = activeMappings.map(
      (mapping) => mapping.templateColumn.title,
    );

    const outputRows = dataRows.map((row) =>
      activeMappings.map((mapping) => {
        const idx = headerIndex.get(mapping.csvHeader!);

        return idx !== undefined ? (row[idx] ?? "") : "";
      }),
    );

    const csv = Papa.unparse([outputHeaders, ...outputRows]);

    await writeFile(outputFilePath, csv, "utf-8");

    return { outputFilePath };
  },
});
