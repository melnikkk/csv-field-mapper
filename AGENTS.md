# AGENTS.md

You are a TypeScript developer experienced with the Mastra framework. You build AI agents, tools, workflows, and scorers. You follow strict TypeScript practices and always consult up-to-date Mastra documentation before making changes.

## CRITICAL: Load `mastra` skill

**BEFORE doing ANYTHING with Mastra, load the `mastra` skill FIRST.** Never rely on cached knowledge as Mastra's APIs change frequently between versions. Use the skill to read up-to-date documentation from `node_modules`.

## Project Overview

This is a **Mastra** project written in TypeScript. Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. The Node.js runtime is `>=22.13.0`.

## Commands

```bash
bun run dev   # Start Mastra Studio at localhost:4111 (long-running, use a separate terminal)
bun run build # Build a production-ready server
bun test      # Run unit tests
```

## Project Structure

| Path                                                        | Description                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/mastra/index.ts`                                       | Mastra instance — registers `csvFieldMapperWorkflow` and LibSQL storage |
| `src/mastra/models.ts`                                      | Shared LLM model exports (Gemini Flash via `@ai-sdk/google`)            |
| `src/mastra/workflow/index.ts`                              | Workflow definition and step chain                                      |
| `src/mastra/workflow/steps/analyze-csv-step/`               | Parse CSV, enforce size/encoding limits, extract headers                |
| `src/mastra/workflow/steps/propose-column-mapping-step/`    | Alias dict lookup → LLM fallback for column mapping                     |
| `src/mastra/workflow/steps/approve-column-mapping-step/`    | Suspend/resume for human review; supports approve/revise/abort          |
| `src/mastra/workflow/steps/apply-column-mapping-step/`      | Rewrite CSV with approved column mappings                               |
| `src/mastra/workflow/steps/validate-cell-values-step/`      | Per-cell validation + auto-fix via `fixerStrategy`                      |
| `src/mastra/workflow/steps/propose-cell-values-fixes-step/` | LLM-assisted fix proposals for cells that couldn't be auto-fixed        |
| `src/mastra/workflow/steps/shared/schemas/`                 | Shared Zod schemas: template, mapping, rows, validation                 |
| `src/mastra/public/outputs/`                                | Runtime output CSVs (intermediate mapped + final validated)             |
| `samples/`                                                  | Test CSVs: well-formed, aliased, large, special chars                   |

### Top-level files

| File            | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `.env.example`  | Copy to `.env` and set `GOOGLE_GENERATIVE_AI_API_KEY`             |
| `package.json`  | Defines project metadata, dependencies, and available bun scripts |
| `tsconfig.json` | TypeScript configuration                                          |

## Boundaries

### Always do

- Load the `mastra` skill before any Mastra-related work
- Register new agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Use schemas for tool inputs and outputs
- Run `bun run build` to verify changes compile

### Never do

- Never commit `.env` files or secrets
- Never modify `node_modules` or Mastra's database files directly
- Never hardcode API keys (always use environment variables)

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
- [Mastra .well-known skills discovery](https://mastra.ai/.well-known/skills/index.json)
