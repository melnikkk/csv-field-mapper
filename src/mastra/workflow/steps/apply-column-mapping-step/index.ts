import { createStep } from "@mastra/core/workflows";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import Papa from "papaparse";
import { z } from "zod";
import { mappingResultsSchema } from "../shared/schemas/mappingSchema";

export const applyColumnMappingStep = createStep({
  id: "apply-column-mapping-step",
  inputSchema: z.object({
    filePath: z.string(),
    approvedMappings: mappingResultsSchema,
  }),
  outputSchema: z.object({
    mappedFilePath: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { filePath, approvedMappings } = inputData;

    const content = await readFile(filePath, "utf-8");
    const { data } = Papa.parse<string[]>(content, {
      header: false,
      skipEmptyLines: true,
    });

    const [headerRow = [], ...dataRows] = data;
    const headerIndex = new Map(headerRow.map((header, i) => [header, i]));

    const activeMappings = approvedMappings.filter(
      (mapping) => mapping.csvHeader !== undefined,
    );

    const headers = activeMappings.map(
      (mapping) => mapping.templateColumn.title,
    );

    const rows = dataRows.map((row) =>
      activeMappings.map((mapping) => {
        const idx = headerIndex.get(mapping.csvHeader!);
        return idx !== undefined ? (row[idx] ?? "") : "";
      }),
    );

    const outputsDir = join(import.meta.dirname, "../..", "outputs");
    await mkdir(outputsDir, { recursive: true });
    const mappedFilePath = join(outputsDir, `csv-mapper-${randomUUID()}.csv`);

    await writeFile(mappedFilePath, Papa.unparse([headers, ...rows]), "utf-8");

    return { mappedFilePath };
  },
});
