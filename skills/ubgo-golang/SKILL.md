---
name: ubgo-golang
description: Use before any Go code change, ent schema, gqlgen resolver or migration. Covers the ubgo stack (ubgo/logger, otelkit, errx and the other github.com/ubgo/* libraries). Not for gopls go.mod errors (use ubgo-gomod-false-positive).
---

# ubgo-golang

Universal Go backend taste for the ubgo stack. Project-agnostic — applies to every Go repo shipping the `github.com/ubgo/*` libraries: **logging** is `github.com/ubgo/logger` (via a project `applog` wrapper, `ulog` fields), **tracing** is `github.com/ubgo/otelkit` (spans via standard `otel.Tracer`), **errors** are `github.com/ubgo/errx` — the retired `lace/gozap`, `lace/gotel`, and `goerr` never appear.

## How to load

1. Read `golang.md` (this skill's body of rules) end-to-end before substantive Go work.
2. **Then check for a project overlay** and read it AFTER. The overlay overrides on conflict. Look in this order, stop at the first hit:
   - `.claude/rules/golang-project.md`
   - `.cursor/rules/golang-project.mdc`
   - `.windsurf/rules/golang-project.md`
   - `.clinerules/golang-project.md`
   - `.codex/rules/golang-project.md`
   - `golang-project.md` at repo root
   - A `## Project Go rules` section inside `AGENTS.md`, `GEMINI.md`, or `.github/copilot-instructions.md`
3. If no overlay exists and the repo is non-trivial Go, suggest the learn mode of the `ubgo-golang-train` skill (`LEARN.md`) to generate one.

## Rules body

See [`golang.md`](./golang.md) in this skill directory. It is the authoritative rules document — sections cover the 3 commandments, the v2 `github.com/ubgo/*` stack, named constants, polymorphism via `ubgo/entx` entpoly, reference tables, DB-as-dumb-storage, validation, logging (`applog`/`ubgo/logger`), tracing (`ubgo/otelkit`), errors (`ubgo/errx`), concurrency, multi-tenant safety, anti-patterns, and the pre-PR checklist.

## When this skill fires

- Any change to Go code (new file, edit, refactor, codegen).
- Designing a new Go service, ent schema, gqlgen resolver, or migration.
- Code review on a Go diff.

## What this skill does NOT cover

- Frontend / TypeScript — different skill.
- Project-specific constants, paths, codegen task names, DB names, git identity — those belong in the overlay. Generate via the learn mode of `ubgo-golang-train`.
