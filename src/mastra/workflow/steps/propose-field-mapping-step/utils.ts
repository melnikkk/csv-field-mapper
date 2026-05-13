import { MappingResults } from "./schema";
import {
  AliasDictionary,
  TemplateColumns,
} from "../shared/schemas/templateSchema";
import { Row, Rows } from "../shared/schemas/rowsSchema";
import { CsvHeaderWithSamples } from "./prompts";

export const mapColumnsBasedOnDictionary = (
  headerRow: Array<string>,
  templateColumns: TemplateColumns,
  aliasDictionary: AliasDictionary | undefined,
): MappingResults => {
  const mappingResults: MappingResults = [];

  for (const templateColumn of templateColumns) {
    const columnAliases = aliasDictionary?.[templateColumn.title];

    const csvHeader = columnAliases
      ? headerRow.find((header) =>
          columnAliases.some(
            (alias) => alias.toLowerCase() === header.toLowerCase(),
          ),
        )
      : undefined;

    mappingResults.push({
      templateColumn,
      csvHeader,
      confidence: csvHeader ? 1 : 0,
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
