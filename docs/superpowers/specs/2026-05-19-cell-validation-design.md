# Cell Validation Design

**Date:** 2026-05-19  
**Branch:** apply-field-mapping-step  
**Status:** Approved

## Context

The workflow is template-agnostic: any caller passes a `template` JSON object describing columns to map to. The goal is to validate cell values after column mapping is approved, auto-fix what can be fixed deterministically, and escalate the rest to the LLM + human approval — mirroring the existing column-mapping approval pattern.

## Constraints

- The workflow is triggered via Mastra Studio / HTTP, so the `template` payload is JSON. Validator functions cannot live in the template.
- Each template has different validation needs; there is no single shared domain.
- Conclusion: validators are expressed as declarative config inline on each template column. Built-in rule types cover deterministic cases; the LLM handles anything ambiguous.

## Template Schema Extension

`templateColumnSchema` gains two new optional fields:

```ts
z.object({
  title: z.string(),
  required: z.boolean(),
  description: z.string().optional(), // fed to LLM when proposing cell fixes
  validators: z.array(validatorRuleSchema).optional(),
  fixerStrategy: fixerStrategySchema.optional(),
});
```

### `validatorRuleSchema` — discriminated union

| `type`      | extra params                                  | what it checks                      |
| ----------- | --------------------------------------------- | ----------------------------------- |
| `required`  | —                                             | non-empty string                    |
| `minLength` | `min: number`                                 | string length lower bound           |
| `maxLength` | `max: number`                                 | string length upper bound           |
| `regex`     | `pattern: string`, `message?: string`         | matches pattern                     |
| `numeric`   | `min?: number`, `max?: number`                | parseable as number, optional range |
| `integer`   | —                                             | whole number                        |
| `date`      | `format?: string`                             | valid date, optional format string  |
| `boolean`   | —                                             | one of: true/false/yes/no/1/0       |
| `enum`      | `values: string[]`, `caseSensitive?: boolean` | value in allowed list               |
| `email`     | —                                             | valid email format                  |
| `url`       | —                                             | valid URL                           |

### `fixerStrategy` — enum

`trim` · `trimAndLower` · `trimAndUpper` · `normalizeWhitespace` · `stripNonNumeric`

Applied to the cell value before validators are re-run. If the fixed value passes all validators, the fix is applied automatically with no user review.

## Data Structures

```ts
type CellValidationResult = {
  rowIndex: number;
  columnTitle: string;
  originalValue: string;
  fixedValue?: string; // present when fixerStrategy produced a valid value
  status: "valid" | "autoFixed" | "needsReview";
  failedRules: string[]; // human-readable descriptions for LLM context
};

type ValidationSummary = {
  headers: string[];
  rows: string[][]; // full mapped rows; auto-fixes applied inline
  autoFixed: CellValidationResult[];
  needsReview: CellValidationResult[];
};

type CellFixSuggestion = {
  rowIndex: number;
  columnTitle: string;
  originalValue: string;
  suggestedValue: string;
  reasoning: string;
};
```

## Pipeline

```
analyzeCsvStep
  → proposeFieldMappingStep
  → approveFieldMappingStep
  → extractMappedRowsStep        ← refactor of mapApprovedFieldsStep (no file write)
  → validateRowsStep             ← NEW
  → proposeCellFixesStep         ← NEW
  → approveCellFixesStep         ← NEW (suspend/resume)
  → writeOutputStep              ← NEW
```

## Step Specifications

### `extractMappedRowsStep` (refactor)

- Same logic as current `mapApprovedFieldsStep`: reads CSV, applies approved column mappings.
- **Change:** returns `{ headers: string[], rows: string[][] }` instead of writing a file.
- Output schema: `z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) })`

### `validateRowsStep`

For each row × column that has `validators` defined:

1. Run all validator rules in order; collect failures as `failedRules`.
2. If any fail and `fixerStrategy` is set: apply the transform to the value, re-run all validators.
3. If now valid → status `autoFixed`; apply fixed value inline to `rows`.
4. If still invalid (or no fixer set) → status `needsReview`.
5. If all rules pass on first attempt → `valid` (not tracked).

Columns with no `validators` defined pass through unchanged.

Output: `ValidationSummary`. If `needsReview` is empty, downstream steps are no-ops.

### `proposeCellFixesStep`

- If `needsReview` is empty: passes `ValidationSummary` through unchanged, no LLM call.
- Otherwise: calls LLM once with all unfixable cells grouped. Per cell, provides:
  - `columnTitle` and `description` (from template)
  - `originalValue`
  - `failedRules` list
- Returns `CellFixSuggestion[]` alongside the `ValidationSummary`.

### `approveCellFixesStep` (suspend/resume)

- Mirrors `approveFieldMappingStep` pattern.
- Suspends and surfaces each `CellFixSuggestion` to the user.
- User accepts or rejects each suggestion individually.
- If `needsReview` was empty, skips suspension and passes through.
- Output: `approvedFixes: CellFixSuggestion[]` + `ValidationSummary`.

### `writeOutputStep`

- Applies `approvedFixes` to `rows` by `rowIndex` + column index (looked up via `headers`).
- Writes final CSV using the same `generateOutputFilePath` utility.
- Output: `{ outputFilePath: string | undefined }` (same as current workflow output).

## Error Handling

- Cells in `needsReview` that the user rejects (LLM suggestion declined) are written with their `originalValue`. No row is dropped.
- If the workflow is aborted at `approveFieldMappingStep`, the `aborted` flag propagates through `extractMappedRowsStep` → `validateRowsStep` → `proposeCellFixesStep` → `approveCellFixesStep` → `writeOutputStep`, each returning early with `outputFilePath: undefined`.
- Validator rule evaluation is order-independent — all rules are checked, all failures collected. No short-circuit on first failure.

## Out of Scope

- Cross-field validation (e.g. "phone format depends on country column") — falls to LLM if needed.
- Custom TypeScript validator functions — not supported; the JSON boundary prevents it.
- Row-level deduplication or structural CSV errors — handled upstream in `analyzeCsvStep`.
