import type { CellValidationResults } from "../../shared/schemas/validationSchema";
import type { TemplateColumns } from "../../shared/schemas/templateSchema";
import { runValidators } from "../validate-cell-values-step/utils";
import type { CorrectedFix } from "./schema";

type ReviseResult =
  | { ok: true; fixes: CellValidationResults }
  | { ok: false; errors: Array<string> };

const cellKey = (rowIndex: number, columnTitle: string): string =>
  `${rowIndex}:${columnTitle}`;

export const reviseFixes = ({
  proposed,
  corrections,
  templateColumns,
}: {
  proposed: CellValidationResults;
  corrections: Array<CorrectedFix>;
  templateColumns: TemplateColumns;
}): ReviseResult => {
  const errors: Array<string> = [];
  const columnsByTitle = new Map(templateColumns.map((c) => [c.title, c]));
  const proposedKeys = new Set(
    proposed.map((p) => cellKey(p.rowIndex, p.columnTitle)),
  );
  const corrected = new Map<string, string>();

  for (const { rowIndex, columnTitle, fixedValue } of corrections) {
    const key = cellKey(rowIndex, columnTitle);
    const label = `row ${rowIndex}, column "${columnTitle}"`;
    const column = columnsByTitle.get(columnTitle);

    if (!proposedKeys.has(key) || !column) {
      errors.push(`Cell not in proposed fixes: ${label}`);
    } else if (corrected.has(key)) {
      errors.push(`Duplicate correction for ${label}`);
    } else if (column.required && fixedValue.trim() === "") {
      errors.push(`Empty value for required column at ${label}`);
    } else {
      const failures = runValidators(fixedValue, column.validators ?? []);

      if (failures.length > 0) {
        errors.push(`Invalid value at ${label}: ${failures.join("; ")}`);
      } else {
        corrected.set(key, fixedValue);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    fixes: proposed.map((fix) => {
      const fixedValue = corrected.get(cellKey(fix.rowIndex, fix.columnTitle));

      return fixedValue === undefined ? fix : { ...fix, fixedValue };
    }),
  };
};
