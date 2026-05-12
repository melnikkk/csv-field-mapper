import { MappingResults } from "./schema";
import {
  AliasDictionary,
  TemplateColumns,
} from "../shared/schemas/templateSchema";

export const mapColumnsBasedOnDictionary = (
  headerRow: Array<string>,
  templateColumns: TemplateColumns,
  aliasDictionary: AliasDictionary | undefined,
): MappingResults => {
  const mappingResults: MappingResults = [];

  for (const templateColumn of templateColumns) {
    const columnAliases = aliasDictionary?.[templateColumn.title];

    const matchedHeader = columnAliases
      ? headerRow.find((header) =>
          columnAliases.some(
            (alias) => alias.toLowerCase() === header.toLowerCase(),
          ),
        )
      : undefined;

    mappingResults.push({
      templateColumn,
      matchedHeader,
      confidence: matchedHeader ? 1 : 0,
    });
  }

  return mappingResults;
};
