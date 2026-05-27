# ubgo-skills

A personal library of agent skills capturing my Golang and frontend conventions. Every skill is namespaced with the `ubgo-` prefix (e.g. `ubgo-golang`) so the collection scales without name collisions.

Each skill lives in its own directory under `skills/` containing a `SKILL.md` with YAML frontmatter (`name`, `description`) plus instructions. Works with Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini, Cline, and others.

## Install

Via [skills.sh](https://www.skills.sh/) (the open-source `skills` CLI):

```bash
# install the whole collection
npx skills add ubgo/ubgo-skills

# or browse first
npx skills
```

Then restart your agent (or reload skills) and invoke a skill by its frontmatter `name`.

## Skills

| Skill | What it does |
|---|---|
| [`ubgo-golang`](skills/ubgo-golang/) | Universal Go backend rules — stack, the 3 commandments (no bare strings, no hardcoded enums, no DB-level business validation), entpoly polymorphism, reference tables, DB-as-dumb-storage, logging/tracing, anti-pattern catalog, pre-PR checklist. Read before any Go change. |
| [`ubgo-golang-learn`](skills/ubgo-golang-learn/) | Learn a Go repo and emit a project-specific overlay (`golang-project.md`) that extends `ubgo-golang` with this repo's named constants, module layout, codegen task names, captured-in-blood gotchas, and workflow. Multi-agent targets (Claude / Cursor / Windsurf / Cline / Codex / Copilot / Gemini). Re-runnable. |
| [`ubgo-frontend`](skills/ubgo-frontend/) | Universal frontend rules — TanStack Start + Base UI (basecn) + Tailwind v4 + gqlkit SDK stack, the 5 commandments (no inline GraphQL, no `useEffect`-for-fetch, no native dialogs, no raw `<select>`, no Radix), design tokens (Fraunces + Geist + compact type scale), forms, data fetching, routing, dialogs/sheets, SSR safety (Nitro `localStorage` trap, barrel-cycle trap), keyboard dispatcher, hard-won traps, AND a long §29 *"Concrete UI patterns"* section with verbatim classNames for every primitive (buttons, inputs, forms, ServerDataTable, EntityShell, QuickView, chips/status pills, color + opacity ramps). Read before any `.tsx` / `.css` change. |
| [`ubgo-wails-desktop`](skills/ubgo-wails-desktop/) | Package an existing Go (Gin + gqlgen + oRPC + tRPC) backend and a Web SPA frontend (TanStack Start / Vite / Next-static / SvelteKit-static) into a single native macOS desktop binary using Wails — with ZERO TCP listeners at runtime. API calls ride the Wails IPC bridge into the existing Gin engine in-memory via `httptest.NewRecorder`. No backend or frontend rewrites. |

## Conventions

- Skill directory + frontmatter `name` both use the `ubgo-` prefix.
- One `SKILL.md` per skill; supporting files (`golang.md`, `frontend.md`, etc.) allowed alongside it as the rules body when a skill grows past a single file.
- Skills are self-contained (no cross-skill imports).
- Rules-body skills (`ubgo-golang`, `ubgo-frontend`) expect a **project overlay** at `frontend-project.md` / `golang-project.md` (or under `.claude/rules/`, `.cursor/rules/`, etc.) that adds repo-specific specifics. Overlay overrides on conflict.
- When the project ships a knowledge-base CLI (`aicodermini`, `lore`, `codeskill`), the skill expects you to query its rules / hotfixes store before substantive work — those are authoritative over the skill body on conflict.
