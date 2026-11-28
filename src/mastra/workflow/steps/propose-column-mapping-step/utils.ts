import {
  AliasDictionary,
  TemplateColumns,
} from "../../shared/schemas/templateSchema";
import { Row, Rows } from "../../shared/schemas/rowsSchema";
import { CsvHeaderWithSamples } from "./prompts";
import { MappingResults } from "../../shared/schemas/mappingSchema";

export const mapColumnsBasedOnDictionary = (
  headerRow: Array<string>,
  templateColumns: TemplateColumns,
  aliasDictionary: AliasDictionary | undefined,
): MappingResults => {
  const mappingResults: MappingResults = [];
  const claimedHeaders = new Set<string>();

  for (const templateColumn of templateColumns) {
    const candidateNames = new Set(
      [
        templateColumn.title,
        ...(aliasDictionary?.[templateColumn.title] ?? []),
      ].map((name) => name.toLowerCase()),
    );

    const csvHeader = headerRow.find(
      (header) =>
        !claimedHeaders.has(header) && candidateNames.has(header.toLowerCase()),
    );

    if (csvHeader !== undefined) claimedHeaders.add(csvHeader);

    mappingResults.push({
      templateColumn,
      csvHeader,
      confidence: csvHeader !== undefined ? 1 : 0,
    });
  }

  return mappingResults;
};

export const getUnmappedTemplateColumnTitles = (
  mappingResults: MappingResults,
) =>
  mappingResults
    .filter(({ confidence }) => confidence === 0)
    .map(({ templateColumn }) => templateColumn.title);

export const getUnresolvedCsvHeadersWithSamples = (
  headerRow: Row,
  mappingResults: MappingResults,
  sampleRows: Rows,
): Array<CsvHeaderWithSamples> =>
  headerRow
    .filter(
      (header) =>
        !mappingResults.some(
          ({ csvHeader }) => csvHeader?.toLowerCase() === header.toLowerCase(),
        ),
    )
    .map((header) => ({
      header,
      samples: sampleRows
        .map((row) => row[headerRow.indexOf(header)])
        .filter(Boolean)
        .slice(0, 3),
    }));
