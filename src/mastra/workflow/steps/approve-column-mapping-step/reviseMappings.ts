import type { MappingResults } from "../../shared/schemas/mappingSchema";
import type { TemplateColumns } from "../../shared/schemas/templateSchema";
import type { CorrectedMapping } from "./schema";

type ReviseResult =
  | { ok: true; mappings: MappingResults }
  | { ok: false; errors: Array<string> };

export const reviseMappings = ({
  proposed,
  corrections,
  templateColumns,
  headerRow,
}: {
  proposed: MappingResults;
  corrections: Array<CorrectedMapping>;
  templateColumns: TemplateColumns;
  headerRow: Array<string>;
}): ReviseResult => {
  const errors: Array<string> = [];
  const titles = new Set(templateColumns.map((c) => c.title));
  const headers = new Set(headerRow);
  const corrected = new Map<string, string | undefined>();

  for (const { templateColumnTitle, csvHeader } of corrections) {
    if (!titles.has(templateColumnTitle)) {
      errors.push(`Unknown template column "${templateColumnTitle}"`);
    } else if (corrected.has(templateColumnTitle)) {
      errors.push(
        `Duplicate entry for template column "${templateColumnTitle}"`,
      );
    } else if (csvHeader !== null && !headers.has(csvHeader)) {
      errors.push(
        `CSV header "${csvHeader}" (column "${templateColumnTitle}") not found in file`,
      );
    } else {
      corrected.set(templateColumnTitle, csvHeader ?? undefined);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const proposedByTitle = new Map(
    proposed.map((m) => [m.templateColumn.title, m]),
  );

  const mappings: MappingResults = templateColumns.map((templateColumn) => {
    if (corrected.has(templateColumn.title)) {
      return {
        templateColumn,
        csvHeader: corrected.get(templateColumn.title),
        confidence: 1,
      };
    }

    const previous = proposedByTitle.get(templateColumn.title);

    return {
      templateColumn,
      csvHeader: previous?.csvHeader,
      confidence: previous?.confidence ?? 0,
    };
  });

  const owners = new Map<string, string>();

  for (const { templateColumn, csvHeader } of mappings) {
    if (csvHeader === undefined) {
      continue;
    }

    const owner = owners.get(csvHeader);

    if (owner !== undefined) {
      errors.push(
        `CSV header "${csvHeader}" assigned to both "${owner}" and "${templateColumn.title}"`,
      );
    } else {
      owners.set(csvHeader, templateColumn.title);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, mappings };
};
