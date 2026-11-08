---
name: ubgo-golang
description: >-
  Universal Go backend rules — stack choices, the 3 commandments (no bare
  strings, no hardcoded enums, no DB-level business validation), entpoly for
  polymorphism, reference tables, DB-as-dumb-storage, logging/tracing,
  secrets, anti-patterns. Read BEFORE any change to Go code. Project-specific
  overrides live in a sibling overlay (see "Overlay" below).
---

# ubgo-golang

Universal Go backend taste. Project-agnostic — applies to every Go repo I ship.

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

See [`golang.md`](./golang.md) in this skill directory. It is the authoritative rules document — sections cover the 3 commandments, stack, named constants, polymorphism via entpoly, reference tables, validation, logging, tracing, secrets, anti-patterns, and pre-PR checklist.

## When this skill fires

- Any change to Go code (new file, edit, refactor, codegen).
- Designing a new Go service, ent schema, gqlgen resolver, or migration.
- Code review on a Go diff.

## What this skill does NOT cover

- Frontend / TypeScript — different skill.
- Project-specific constants, paths, codegen task names, DB names, git identity — those belong in the overlay. Generate via `ubgo-golang-learn`.
