import {
  ValidatorRule,
  TemplateColumn,
  TemplateColumns,
} from "../shared/schemas/templateSchema";
import {
  CellValidationResult,
  CellValidationResults,
} from "../shared/schemas/validationSchema";

const formatValidator = (rule: ValidatorRule): string => {
  switch (rule.type) {
    case "required":
      return "must not be empty";
    case "minLength":
      return `minimum length: ${rule.min}`;
    case "maxLength":
      return `maximum length: ${rule.max}`;
    case "regex":
      return rule.message ?? `must match pattern: ${rule.pattern}`;
    case "numeric": {
      const parts: Array<string> = ["must be a number"];
      if (rule.min !== undefined) parts.push(`min: ${rule.min}`);
      if (rule.max !== undefined) parts.push(`max: ${rule.max}`);
      return parts.join(", ");
    }
    case "integer":
      return "must be an integer";
    case "date":
      return rule.format
        ? `must be a date in format: ${rule.format}`
        : "must be a valid date";
    case "boolean":
      return "must be a boolean (true/false)";
    case "enum":
      return `must be one of: ${rule.values.join(", ")}${rule.caseSensitive ? " (case-sensitive)" : ""}`;
    case "email":
      return "must be a valid email address";
    case "url":
      return "must be a valid URL";
  }
};

const formatColumnRules = (column: TemplateColumn): string => {
  const lines: Array<string> = [`Column: "${column.title}"`];
  if (column.description) lines.push(`  Description: ${column.description}`);
  if (column.validators?.length) {
    lines.push("  Rules:");
    for (const rule of column.validators) {
      lines.push(`    - ${formatValidator(rule)}`);
    }
  }
  return lines.join("\n");
};

const formatCell = (cell: CellValidationResult): string =>
  `  Row ${cell.rowIndex}: "${cell.originalValue}" (failed: ${cell.failedRules.join(", ")})`;

export const buildCellValuesFixesPrompt = (
  needsReview: CellValidationResults,
  templateColumns: TemplateColumns,
): string => {
  const columnByTitle = new Map(templateColumns.map((col) => [col.title, col]));

  const grouped = new Map<string, CellValidationResults>();
  for (const cell of needsReview) {
    const group = grouped.get(cell.columnTitle) ?? [];
    group.push(cell);
    grouped.set(cell.columnTitle, group);
  }

  const sections = Array.from(grouped.entries()).map(([columnTitle, cells]) => {
    const column = columnByTitle.get(columnTitle);
    const rulesText = column
      ? formatColumnRules(column)
      : `Column: "${columnTitle}"`;
    const cellsText = cells.map(formatCell).join("\n");
    return [rulesText, "  Cells to fix:", cellsText].join("\n");
  });

  return [
    "You are a data quality assistant. For each cell below, propose a corrected value that satisfies all the column rules.",
    "Return a proposed fix for every cell. If no meaningful fix is possible, return an empty string.",
    "",
    ...sections,
  ].join("\n\n");
};
