---
name: ubgo-golang-learn
description: >-
  Learn a Go repo and emit a project-specific overlay (golang-project.md) that
  extends the global ubgo-golang rules with this repo's named constants,
  module layout, codegen task names, captured-in-blood gotchas, and workflow.
  Re-runnable. Use when the user says "generate the project Go rules", "learn
  this repo", "write golang-project.md", or "set up Go agent rules for this
  project".
---

# ubgo-golang-learn

Generate (or refresh) the per-repo Go overlay that pairs with the global `ubgo-golang` skill.

## Output

A single overlay file containing ONLY the deltas from global rules — never restates them. Section template (mirrors the sync_go reference overlay):

1. Named constants — what already exists, do NOT reinvent (with file paths).
2. Module layout (go.work members, what each module owns).
3. Reference tables — what's already in this shape.
4. Polymorphic (entpoly) — tables already in this shape; index naming convention.
5. Localized text / i18n shape (if applicable).
6. GraphQL surface (gqlgen merger, DTO location, codegen chain).
7. Codegen task flags that are NOT optional (with reasons).
8. DB-name gotcha (configured DB name, backup command, migration command).
9. Secrets — repo-specific paths and rotation notes.
10. Project anti-patterns (additions to the generic catalog).
11. Workflow / process (git identity, Taskfile rule, commit policy, portless domains).
12. Pre-PR checklist addendum.
13. Knowledge store pointer (lore / aicoder / none).

Each section is optional — emit only if the repo has content for it.

## Flow

### Step 1 — Pick the target agent(s)

Ask via `AskUserQuestion` (multi-select): which agent(s) should consume the overlay? Pre-check whichever marker dirs already exist in the repo.

| Agent | Output path | Format |
|---|---|---|
| Claude Code | `.claude/rules/golang-project.md` + `@.claude/rules/golang-project.md` import in `CLAUDE.md` | plain markdown |
| Cursor | `.cursor/rules/golang-project.mdc` | `.mdc` with frontmatter (`description`, `globs: ["**/*.go"]`, `alwaysApply: false`) |
| Windsurf | `.windsurf/rules/golang-project.md` | plain markdown |
| Cline | `.clinerules/golang-project.md` | plain markdown |
| Codex | `.codex/rules/golang-project.md` OR append `## Project Go rules` to `AGENTS.md` | ask which |
| Copilot | Append `## Project Go rules` to `.github/copilot-instructions.md` | section append |
| Gemini CLI | Append `## Project Go rules` to `GEMINI.md` | section append |
| Generic / portable | `./golang-project.md` at repo root | plain markdown |

Multi-select allowed — emit to each chosen target.

### Step 2 — Detect

Read the repo to harvest deltas:

- `go.work`, every `go.mod` — module list + Go version.
- `Taskfile.yml` (and per-module Taskfiles) — task names, env flags (`GOWORK=`, `GOFLAGS=`, `CGO_ENABLED=`, etc.).
- Any `constants.go` / `types.go` — closed-set values that already have typed constants. Glob `**/{constants,types}.go`.
- `ent/schema/**/*.go` or `*/schema/**/*.go` — ent schemas, entpoly mixins, polymorphic tables, JSONB i18n fields, reference tables.
- `gqlgen.yml`, `*.graphql`, resolver dirs — GraphQL surface + DTO locations.
- `migrations/` or atlas config — DB name source (often `config/pkl/env/default/app.pkl`, `.env`, `docker-compose.yml`).
- `.lore/`, `.aicoder/`, `AGENTS.md`, existing `CLAUDE.md` — knowledge-store pointer + workflow rules already declared.
- `.gitconfig` / `.git/config` — local git identity if overridden.
- `lace/` imports — confirm wrappers are in use (or flag direct `pgx` / `nats.go` / `zap` usage as a deviation).

### Step 3 — Interview

For things code can't reveal, ask the user briefly:

- Captured-in-blood gotchas (wrong DB names, env-flag traps, codegen quirks)?
- Git identity for this repo (often differs from global)?
- Secret rotation status / known-leaked tokens?
- Anything that should NEVER be done in this repo that isn't already in the global rules?

Keep interview ≤ 4 questions. Skip if repo is small or user says "skip questions".

### Step 4 — Emit

Write the overlay to each chosen target. Required opening line:

> Read this AFTER global `ubgo-golang`. Generic rules apply unchanged. This file is the `<repo>` overlay: deltas only.

Required closing line:

> Regenerate via the `ubgo-golang-learn` skill.

Wrap any user-supplied prose in `<!-- ubgo:keep -->` / `<!-- /ubgo:keep -->` markers so re-runs preserve it.

For Claude Code target: also ensure `CLAUDE.md` has a `@.claude/rules/golang-project.md` import line near the top (add it if missing; do not duplicate).

### Step 5 — Re-runnable

If the overlay already exists:

- Parse existing `<!-- ubgo:keep -->` blocks and preserve verbatim.
- Refresh auto-derived tables (constants registry, module list, polymorphic tables) in place.
- Show a unified diff and ask before overwriting.

## Rules

- NEVER restate global `ubgo-golang` rules in the overlay — overlay is deltas only.
- Every constant / table / file path cited in the overlay must actually exist (verify via `grep` before writing).
- Plain markdown, no hard-wrap (single physical line per paragraph / table row).
- No Claude / AI / Co-Authored-By mentions anywhere in emitted files.
- If the repo is not a Go project (no `go.mod` anywhere), refuse and tell the user.
