# CSV Mapping & Validation Workflow

A Mastra workflow that accepts an arbitrary CSV, maps its columns to a known schema, suspends for human confirmation on ambiguous mappings, validates all rows, and produces a structured report.

## Why a workflow, not an agent

The execution path is fully deterministic: parse → map → [suspend if ambiguous] → validate → report. The LLM is invoked at exactly one point (fuzzy column matching). No dynamic tool selection needed.

## Tech Stack

| Layer              | Choice                  |
| ------------------ | ----------------------- |
| Language           | TypeScript              |
| Workflow framework | Mastra (`@mastra/core`) |
| LLM                | OpenAi                  |
| CSV parsing        | PapaParse               |
| Schema validation  | Zod                     |
| Runtime            | Node.js / tsx           |

## Project Structure

```
src/
├── workflow.ts               # Mastra workflow definition
├── steps/
│   ├── analyze-csv.ts        # Parse CSV, extract structure
│   ├── propose-mapping.ts    # Alias dict → LLM fallback → suspend for confirmation
│   ├── validate-rows.ts      # Per-row, per-field validation + auto-fix proposals
│   └── generate-report.ts    # Final structured report assembly
├── schema/
│   ├── catalog-schema.ts     # Field definitions
│   ├── alias-dictionary.ts   # Known synonyms per field
│   └── validators.ts         # Field-level validators
└── types.ts                  # MappingResult, ValidationError, Report
samples/                      # Test CSVs: well-formed, aliased, ambiguous, errors
```

## Workflow Steps

**Step 1 — `analyze-csv`**: Reads and parses the CSV, extracts headers, sample rows, and total row count.

**Step 2 — `propose-mapping`**: Two-pass column resolution:

1. Alias dictionary lookup (fast, deterministic)
2. LLM fallback for unresolved headers
   Suspends if any mappings are ambiguous, waiting for user confirmation before proceeding.

**Step 3 — `validate-rows`**: Applies the full validation ruleset, collecting errors, auto-fixes, and warnings.

**Step 4 — `generate-report`**: Assembles a structured `ValidationReport` from all step outputs.

## Getting Started

```shell
bun run dev
```

Open [http://localhost:4111](http://localhost:4111) to access Mastra Studio — an interactive UI for testing the workflow and inspecting traces.

## Learn More

- [Mastra Docs — Workflows](https://mastra.ai/docs/workflows)
- [Mastra Docs — Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume)
- [Mastra Docs — Human-in-the-loop](https://mastra.ai/docs/workflows/human-in-the-loop)
