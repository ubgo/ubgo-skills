---
name: ubgo-frontend-train
description: >-
  Training loop for the `ubgo-frontend` skill. Captures universal frontend
  / UI / UX learnings encountered during real-world coding sessions back into
  the canonical `frontend.md` so the skill keeps getting smarter with use.
  Re-run whenever a frontend task surfaces a pattern, anti-pattern, gotcha,
  or sharper rule that would help future agents. Auto-invoke when the user
  says "update the skill", "capture this", "train the skill", "save this
  lesson", "add to frontend rules", or whenever YOU (the agent) notice
  during frontend work a rule worth promoting from one-off tactic to
  documented taste. Distinguishes universal-worthy lessons (→ canonical
  `frontend.md`) from project-specific facts (→ project overlay
  `frontend-project.md`) from session noise (→ neither). Syncs canonical to
  installed copies.
---

# ubgo-frontend-train

The training-by-use loop for `ubgo-frontend`. Reads any frontend session's history, identifies lessons worth capturing, writes them into the canonical skill body, syncs to installed copies. Re-runnable; idempotent. Every real session that surfaces a universal lesson teaches the skill — that's the entire point of the name.

## How to load

1. Read `TRAIN.md` (this skill's body) end-to-end before writing back.
2. **Always pair with `ubgo-frontend`** — you can't decide what's universal-worthy without knowing what's already there. Load `ubgo-frontend` first; this skill operates on top of it.
3. If the repo has an `.aicoder/` / `.lore/` / `.codeskill/` knowledge store, query its rules + hotfixes + taste_prefs first — they may already capture the lesson; don't duplicate.

## Standing policy (from the maintainer)

> Any frontend task you do — if you (the agent) think a lesson is worth promoting from "I figured this out once" to "every future agent should know this" — write it to the skill file BEFORE moving on. No asking. The skill gets smarter every session, not just when explicitly triggered.

The body (`TRAIN.md`) makes this operational: where to write, what to write, what counts as universal vs project-specific, how to format, how to sync.

## When this skill fires

- **User-triggered:** "update the frontend skill", "capture this", "train the skill", "save this lesson", "add to frontend rules", "remember this for next time", "make this a rule"
- **Agent-triggered (proactive):** during frontend work you notice
  - a pattern shipped here would help on the next page / next project
  - a hard-won bug whose root cause maps to a generic gotcha
  - a mismatch between what the skill prescribes and what the project actually emits (component default sizes, codegen output shapes, etc.)
  - a verbatim className / shape you copied from another file you'd want a future agent to find without searching
  - a mistake you made because the skill didn't warn you — promote the warning
- **NOT a trigger:** session-specific facts (this customer's brand colors, this product's API endpoints, this repo's component import paths) — those go to the project overlay, not the canonical skill.

## What this skill does NOT cover

- **Project-specific learnings** — those go to `frontend-project.md` (the overlay), not the canonical `frontend.md`. If the lesson contains a file path, repo name, customer name, tenant ID, channel code, or named constant specific to one codebase → overlay, not canonical.
- **Generating a fresh overlay from a repo** — that's `ubgo-frontend-learn` / `ubgo-frontend-train-project` (sibling skill, if it exists; otherwise do the overlay manually per `ubgo-golang-learn`'s pattern).
- **Backend learnings** — `ubgo-golang-learn` for project overlays, edit `ubgo-golang/golang.md` directly for universal Go rules (or write a `ubgo-golang-train` sibling using this skill's shape).
- **Captures into project knowledge stores** (`lore memory add`, `aicoder taste_pref add`, etc.) — separate skill flow.

## Output

A diff to the canonical `ubgo-frontend/frontend.md` (and sometimes its anti-pattern catalog §26 + checklist §27 in matched edits), plus a sync `cp` to installed copies. See `TRAIN.md` for exact paths + format + section-targeting rules.
