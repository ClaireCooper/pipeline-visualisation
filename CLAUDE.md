# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install       # Install dependencies
npm run dev       # Start local dev server with hot reload (http://localhost:5173)
npm test          # Run tests once
npm run test:watch  # Run tests in watch mode
npm run build     # Type-check and build to dist/
```

To run a single test file:

```sh
npx vitest run src/parser.test.ts
```

## Architecture

This is a single-page TypeScript app built with Vite that visualises CI/CD pipelines as dependency graphs.

**Data flow:**

1. `editor.ts` — CodeMirror editor watches for YAML changes (300 ms debounce) and calls `parse()`
2. `parser.ts` — parses YAML into `ParsedPipeline` (a map of workflow name → `Workflow` with `nodes[]` and `edges[]`); returns a discriminated union `ParseResult`; detects circular `uses` references
3. `elements.ts` — converts a `Workflow` into Cytoscape element descriptors (`CyElement[]`)
4. `graph.ts` — owns the `cytoscape` instance; `renderWorkflow()` clears and reloads elements using the dagre layout
5. `scheduler.ts` — pure scheduling logic; `calculateScheduledJobs()` topologically sorts a workflow and assigns start/end times to each job; `criticalPathDuration()` returns the total span
6. `gantt.ts` — renders a zoomable SVG Gantt chart from `ScheduledJob[]`; `assignRows()` packs bars vertically to minimise rows; bars show truncated labels and duration tooltips
7. `app.ts` — wires everything together; owns the `NavStack` state for drill-down navigation; manages the graph/Gantt view toggle
8. `navigation.ts` — pure immutable helpers (`push`/`pop`/`current`) for the workflow navigation stack

**Key data types:**

- `ParsedPipeline` — `{ workflows: Record<string, Workflow> }` (in `parser.ts`)
- `Workflow` — `{ nodes: JobNode[], edges: Edge[] }` (in `parser.ts`)
- `JobNode` — `{ id, duration?, uses? }` — `uses` means this job delegates to another named workflow (in `parser.ts`)
- `ScheduledJob` — `{ id, start, end, uses? }` — job with computed start/end times in minutes (in `scheduler.ts`)

**Drill-down navigation:** Clicking a node with a `uses` field pushes that workflow onto the `NavStack` and re-renders. The breadcrumb and back button in `app.ts` reflect this stack.

**Gantt view:** A toggle in `app.ts` switches between the dependency graph and a Gantt chart. The Gantt chart is rendered as an inline SVG by `gantt.ts`, sized to fit the container width, with zoom/pan via mouse wheel and drag.

## Branch names

Kebab-case description of the work:

```
add-navigation-stack
fix-parser-bug
refactor-graph-layout
```

## Commit messages

Imperative mood, sentence case, no trailing period:

```
Add navigation stack
Extract parseNeeds helper
Split app.ts into graph.ts and editor.ts
```

Commit messages are spell-checked by a pre-commit hook (`spell-check-commit-msgs`).

## Pre-commit hooks

The repo uses `pre-commit` with Prettier (formatting), ESLint (TypeScript linting via `eslint.config.cjs` — strict + stylistic `typescript-eslint` rules), codespell (spelling), shellcheck, actionlint, and a `todo-check` hook that blocks `TODO` comments in committed code. Commits to `main` are blocked locally (allowed in CI via the `ci.skip` override). Version bumps are managed automatically via `version-txt-auto-msg`.

## CI/CD

- **test.yaml** — runs `npm test` on push/PR to `main`
- **release.yaml** — on push to `main`: tags a new version from `version.txt`, builds, and deploys `dist/` to GitHub Pages
