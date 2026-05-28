---
name: ubgo-golang-train
description: >-
  Training loop for the `ubgo-golang` skill. Captures universal Go backend
  learnings encountered during real-world coding sessions back into the
  canonical `golang.md` so the skill keeps getting smarter with use. Re-run
  whenever a backend task surfaces a pattern, anti-pattern, gotcha, or
  sharper rule that would help future agents. Auto-invoke when the user
  says "update the golang skill", "capture this", "train the skill", "save
  this lesson", "add to backend rules", or whenever YOU (the agent) notice
  during Go work a rule worth promoting from one-off tactic to documented
  taste. Distinguishes universal-worthy lessons (→ canonical `golang.md`)
  from project-specific facts (→ project overlay `golang-project.md` via
  `ubgo-golang-learn`) from session noise (→ neither). Syncs canonical to
  installed copies via runtime path discovery (never hardcoded).
---

# ubgo-golang-train

The training-by-use loop for `ubgo-golang`. Reads any backend session's history, identifies lessons worth capturing, writes them into the canonical skill body, syncs to installed copies. Re-runnable; idempotent. Every real session that surfaces a universal-worthy lesson teaches the skill — that's the entire point of the name.

Sister skill to `ubgo-frontend-train` (same shape, different target: the Go skill instead of the frontend skill).

## How to load

1. Read `TRAIN.md` (this skill's body) end-to-end before writing back.
2. **Always pair with `ubgo-golang`** — you can't decide what's universal-worthy without knowing what's already there. Load `ubgo-golang` first; this skill operates on top of it.
3. If the repo has an `.aicoder/` / `.lore/` / `.codeskill/` knowledge store, query its rules + hotfixes + taste_prefs first — they may already capture the lesson; don't duplicate.

## Standing policy (from the maintainer)

> Any Go backend task you do — if you (the agent) think a lesson is worth promoting from "I figured this out once" to "every future agent should know this" — write it to the skill file BEFORE moving on. No asking. The skill gets smarter every session, not just when explicitly triggered.

The body (`TRAIN.md`) makes this operational: where to write, what to write, what counts as universal vs project-specific, how to format, how to sync.

## When this skill fires

- **User-triggered:** "update the golang skill", "capture this", "train the skill", "save this lesson", "add to backend rules", "remember this for next time", "make this a rule"
- **Agent-triggered (proactive):** during Go work you notice
  - a pattern shipped here would help on the next service / next module / next project
  - a hard-won bug whose root cause maps to a generic gotcha (codegen race, migration trap, vendor-vs-workspace conflict, etc.)
  - a mismatch between what the skill prescribes and what the project actually emits (ent default behaviour, gqlgen output shape, entpoly column naming, etc.)
  - a verbatim service pattern / helper signature you copied from another file you'd want a future agent to find without searching
  - a mistake you made because the skill didn't warn you — promote the warning
- **NOT a trigger:** session-specific facts (this customer's DB name, this project's named constants, this repo's import paths, this tenant's channel kinds) — those go to the project overlay (`golang-project.md` via `ubgo-golang-learn`), not the canonical skill.

## What this skill does NOT cover

- **Project-specific learnings** — those go to `golang-project.md` (the overlay) via the `ubgo-golang-learn` skill, NOT the canonical `golang.md`. If the lesson contains a file path, repo name, customer name, tenant ID, channel code, DB name, or named constant specific to one codebase → overlay, not canonical.
- **Generating a fresh per-repo overlay** — that's `ubgo-golang-learn`. Use it when bootstrapping a new repo's `golang-project.md`. This skill is for canonical updates only.
- **Frontend learnings** — `ubgo-frontend-train` for universal frontend rules, `ubgo-frontend-learn` (if it exists) for per-repo overlays. Backend (`.go` / `go.mod` / migrations / SQL) only here.
- **Captures into project knowledge stores** (`lore memory add`, `aicoder taste_pref add`, etc.) — separate skill flow.

## Output

A diff to the canonical `ubgo-golang/golang.md` (often paired with matching edits in the anti-pattern catalog + pre-PR checklist sections), plus a sync to every discovered installed copy via the path-discovery ritual. See `TRAIN.md` for exact discovery + format + section-targeting rules.
