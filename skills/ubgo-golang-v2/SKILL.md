---
name: ubgo-golang-v2
description: >-
  Universal Go backend rules for the v2 ubgo stack — logging via
  github.com/ubgo/logger (applog wrapper), tracing via github.com/ubgo/otelkit,
  errors via github.com/ubgo/errx, plus ubgo/cache, ubgo/lock, ubgo/health,
  ubgo/shutdown, ubgo/entx, ubgo/publicid, ubgo/crypt. Same taste as ubgo-golang
  (3 commandments, entpoly, reference tables, DB-as-dumb-storage, naming,
  concurrency, multi-tenant, anti-patterns) but with the v2 stack — NO
  lace/gozap, lace/gotel, or goerr. Read BEFORE any change to Go code in a v2
  repo. Project-specific overrides live in a sibling overlay.
---

# ubgo-golang-v2

Universal Go backend taste for the **v2 stack**. Project-agnostic — applies to every Go repo shipping the `github.com/ubgo/*` libraries. Same rules as `ubgo-golang`, reconciled to the current stack: **logging** is `github.com/ubgo/logger` (via a project `applog` wrapper, `ulog` fields), **tracing** is `github.com/ubgo/otelkit` (spans via standard `otel.Tracer`), **errors** are `github.com/ubgo/errx` — the retired `lace/gozap`, `lace/gotel`, and `goerr` never appear. Prefer this over `ubgo-golang` for any repo already on the ubgo v2 stack.

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
3. If no overlay exists and the repo is non-trivial Go, suggest the user run the `ubgo-golang-learn` skill to generate one.

## Rules body

See [`golang.md`](./golang.md) in this skill directory. It is the authoritative rules document — sections cover the 3 commandments, the v2 `github.com/ubgo/*` stack, named constants, polymorphism via `ubgo/entx` entpoly, reference tables, DB-as-dumb-storage, validation, logging (`applog`/`ubgo/logger`), tracing (`ubgo/otelkit`), errors (`ubgo/errx`), concurrency, multi-tenant safety, anti-patterns, and the pre-PR checklist.

## When this skill fires

- Any change to Go code (new file, edit, refactor, codegen).
- Designing a new Go service, ent schema, gqlgen resolver, or migration.
- Code review on a Go diff.

## What this skill does NOT cover

- Frontend / TypeScript — different skill.
- Project-specific constants, paths, codegen task names, DB names, git identity — those belong in the overlay. Generate via `ubgo-golang-learn`.
