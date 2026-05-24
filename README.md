# CSV Mapping & Validation Workflow

A Mastra workflow that accepts an arbitrary CSV, maps its columns to a known schema, suspends for human confirmation on ambiguous mappings, validates all cell values, and proposes AI-assisted fixes for any cells that fail validation.

## Why a workflow, not an agent

The execution path is fully deterministic: parse → map → [suspend for review] → apply → validate → propose fixes. The LLM is invoked at exactly two points (fuzzy column matching and cell value fix suggestions). No dynamic tool selection needed.

## Tech Stack

| Layer              | Choice                                |
| ------------------ | ------------------------------------- |
| Language           | TypeScript                            |
| Workflow framework | Mastra (`@mastra/core`)               |
| LLM                | Google Gemini 2.5 Flash (via AI SDK)  |
| CSV parsing        | PapaParse                             |
| Schema validation  | Zod                                   |
| Runtime            | Bun (>=22.13.0)                       |
| Storage            | LibSQL (local SQLite via `mastra.db`) |

## Project Structure

```
src/mastra/
├── index.ts                          # Mastra instance — registers workflow and storage
├── models.ts                         # Shared LLM model definitions
├── workflow/
│   ├── index.ts                      # Workflow definition and step chain
│   └── steps/
│       ├── analyze-csv-step/         # Parse CSV, check size/encoding, extract headers
│       ├── propose-column-mapping-step/  # Alias dict → LLM fallback for column mapping
│       ├── approve-column-mapping-step/  # Suspend/resume for human mapping review
│       ├── apply-column-mapping-step/    # Rewrite CSV with approved column mappings
│       ├── validate-cell-values-step/    # Per-cell validation + auto-fix application
│       ├── propose-cell-values-fixes-step/ # LLM-assisted fix proposals for failed cells
│       └── shared/schemas/           # Shared Zod schemas (template, mapping, validation)
samples/                              # Test CSVs: well-formed, aliased, large, special chars
```

## Workflow Steps

**Step 1 — `analyze-csv`**: Reads the CSV file, checks file size against `maxFileSize` and UTF-8 encoding, then extracts the header row, a sample of data rows, and total row count.

**Step 2 — `propose-column-mapping`**: Two-pass column resolution:

1. Alias dictionary lookup (fast, deterministic) — maps known synonyms to template columns
2. LLM fallback (Gemini Flash) for any headers still unresolved after the dictionary pass

**Step 3 — `approve-column-mapping`**: Suspends the workflow and presents the proposed mappings to the user. Supports three resume actions: `approve`, `revise` (re-suspends with corrected mappings), or `abort`.

**Step 4 — `apply-column-mapping`**: Rewrites the CSV using only the approved column mappings, producing a new intermediate file with template-aligned headers.

**Step 5 — `validate-cell-values`**: Runs per-cell validators defined on each template column. Cells that fail but can be auto-fixed (via `fixerStrategy`) are corrected in place; remaining failures are flagged as `needs-review`.

**Step 6 — `propose-cell-values-fixes`**: For cells that could not be auto-fixed, calls Gemini Flash to suggest corrected values. Returns the final validated CSV path alongside the proposed fix list.

## Template Schema

The workflow is driven by a `Template` object passed as workflow input:

```ts
{
  maxFileSize: number,           // bytes
  columns: Array<{
    title: string,
    required: boolean,
    description?: string,
    validators?: ValidatorRule[],  // required, minLength, maxLength, regex, numeric, integer, date, boolean, enum, email, url
    fixerStrategy?: 'trim' | 'trimAndLower' | 'trimAndUpper' | 'normalizeWhitespace' | 'stripNonNumeric'
  }>,
  aliasDictionary?: Record<string, string[]>  // templateColumnTitle → [csv header aliases]
}
```

## Getting Started

```shell
cp .env.example .env
# Add your GOOGLE_GENERATIVE_AI_API_KEY to .env

bun run dev
```

Open [http://localhost:4111](http://localhost:4111) to access Mastra Studio — an interactive UI for testing the workflow and inspecting traces.

## Learn More

- [Mastra Docs — Workflows](https://mastra.ai/docs/workflows)
- [Mastra Docs — Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume)
- [Mastra Docs — Human-in-the-loop](https://mastra.ai/docs/workflows/human-in-the-loop)
