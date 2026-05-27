---
name: ubgo-frontend
description: >-
  Universal frontend rules — stack (TanStack ecosystem + Base UI + Tailwind v4
  + gqlkit), the 5 commandments (no inline GraphQL, no useEffect-for-fetch,
  no native dialogs/selects, no Radix), design tokens (Fraunces + Geist +
  compact type scale), forms, data fetching, routing, dialogs, SSR safety,
  drawer/sheet widths, keyboard dispatcher, hard-won traps. Read BEFORE any
  change to TypeScript / React / `.tsx` / styling code in this project's
  frontend repo. Project-specific overrides live in a sibling overlay (see
  "Overlay" below).
---

# ubgo-frontend

Universal frontend taste. Project-agnostic — applies to every frontend repo I ship (TanStack Start + React + basecn/Base UI + Tailwind v4 + gqlkit being the canonical stack; rules degrade gracefully on adjacent stacks).

## How to load

1. Read `frontend.md` (this skill's body of rules) end-to-end before substantive frontend work.
2. **Then check for a project overlay** and read it AFTER. The overlay overrides on conflict. Look in this order, stop at the first hit:
   - `.claude/rules/frontend-project.md`
   - `.cursor/rules/frontend-project.mdc`
   - `.windsurf/rules/frontend-project.md`
   - `.clinerules/frontend-project.md`
   - `.codex/rules/frontend-project.md`
   - `frontend-project.md` at repo root
   - A `## Project frontend rules` section inside `AGENTS.md`, `GEMINI.md`, or `.github/copilot-instructions.md`
3. If the project has an `.aicoder/`, `.lore/`, or `.codeskill/` directory, query its `rules` / `hotfixes` / `taste_prefs` / `patterns` stores before substantive work — they hold the most current project-specific frontend rules and are authoritative on conflict with this skill.

## Rules body

See [`frontend.md`](./frontend.md) — the authoritative rules document. Covers stack, the 5 commandments, design tokens, components, forms, data fetching, state, routing, dialogs/sheets, SSR safety, keyboard, anti-pattern catalog, pre-PR checklist, AND a long **§29 "Concrete UI patterns"** section with verbatim classNames for buttons, inputs, forms, dialogs, cards, ServerDataTable, bulk-action bar, search input, sidebar, EntityShell, chips/status pills, quick-view drawer, empty/skeleton/toast/tabs/kanban/cmdk/pagination, plus the color + text-opacity + density rules. When in doubt about visuals — copy from §29 literally.

## When this skill fires

- Any change to a `.tsx` / `.ts` / `.css` file under `src/` (components, routes, features, lib, styles).
- Creating a new page, route, dialog, form, table, or quick-view surface.
- Touching Tailwind config, theme tokens, fonts, or `styles.css`.
- Code review on a frontend diff.
- Designing a new UI surface — read BEFORE writing JSX.

## What this skill does NOT cover

- Backend / Go — see `ubgo-golang`.
- Project-specific component paths (e.g. `<ConfirmDelete>` location, `EnumSelect` import path, sidebar nav structure, route prefixes) — those belong in the overlay.
- Visual design direction (editorial / brutalist / terminal / etc.) — that's per-project; commit to one in the overlay before coding.
