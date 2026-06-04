import { TemplateColumns } from "../../shared/schemas/templateSchema";

export interface CsvHeaderWithSamples {
  header: string;
  samples: Array<string>;
}

export const buildColumnMappingPrompt = (
  unresolvedHeadersWithsSamples: Array<CsvHeaderWithSamples>,
  templateColumns: TemplateColumns,
): string => {
  const headersText = unresolvedHeadersWithsSamples
    .map(({ header, samples }) => {
      const samplesString = samples.length
        ? ` (samples: ${samples.map((sample) => `"${sample}"`).join(", ")})`
        : "";

      return `- "${header}"${samplesString}`;
    })
    .join("\n");

  const schemaText = templateColumns
    .map((column) => `- ${column.title}${column.required ? " (required)" : ""}`)
    .join("\n");

  return [
    "Map each CSV header to the most appropriate template column.",
    "Set templateColumn to null if no confident match exists (confidence < 0.4).",
    "",
    "CSV headers to resolve:",
    headersText,
    "",
    "Template schema:",
    schemaText,
  ].join("\n");
};
