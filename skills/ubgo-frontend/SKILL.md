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

## Playbooks (run THESE for common asks)

End-to-end recipes. Read the playbook before starting the work it covers — saves a session of iteration.

| Playbook | When to run |
|---|---|
| [`playbooks/00-build-a-page.md`](./playbooks/00-build-a-page.md) | User asks for a new list / CRUD / settings page. Step-by-step from shell to dialog with done-criteria checklist. |
| [`playbooks/01-density-pass.md`](./playbooks/01-density-pass.md) | User says "make it sleeker / Polaris-grade / Linear-tight / too big / too washy" — convert the whole project to Polaris-dense flavor in one pass. |

## Verbatim reference primitives — `examples/`

Copy-paste-ready primitive files. Drop into `src/components/ui/` (or `src/components/`) and rename imports to fit the project. Every Polaris-dense rule from §29 is already baked in.

| File | Drop into | Bakes in |
|---|---|---|
| [`examples/button.tsx`](./examples/button.tsx) | `src/components/ui/button.tsx` | h-7 default, text-[12px], cursor-pointer, active:translate-y-px, no shadow, all variants |
| [`examples/input.tsx`](./examples/input.tsx) | `src/components/ui/input.tsx` | h-7, flat 1px border, clean focus ring, no shadow-sm |
| [`examples/native-select.tsx`](./examples/native-select.tsx) | `src/components/ui/native-select.tsx` | appearance-none + lucide chevron — fixes raw `<select>` row alignment |
| [`examples/dialog-3-zone.tsx`](./examples/dialog-3-zone.tsx) | `src/components/ui/dialog.tsx` | 3-zone Header/Body/Footer with separator lines, close X cursor-pointer, DialogBody export |
| [`examples/dropdown-menu.tsx`](./examples/dropdown-menu.tsx) | `src/components/ui/dropdown-menu.tsx` | py-1 text-[12px] items, icons size-3.5, p-0.5 outer, destructive variant, full Radix surface (Item/Checkbox/Radio/Label/Separator/Sub) |
| [`examples/page-header.tsx`](./examples/page-header.tsx) | `src/components/admin-shell.tsx` (export `PageHeader`) | 5-slot shape (icon / title / subtitle / primaryAction / secondaryActions / right), `border-b pb-3 mb-4` |
| [`examples/admin-shell.tsx`](./examples/admin-shell.tsx) | `src/components/admin-shell.tsx` (also exports PageHeader + StatusBadge) | Full app chrome: 220px sidebar (brand + sections + user-footer), mixed-case section labels, active-bg-primary/10, no shadow. Plus StatusBadge with 6 tones. |
| [`examples/settings-shell.tsx`](./examples/settings-shell.tsx) | `src/components/settings-shell.tsx` | Second-level shell for `/settings/*` — 200px sub-sidebar that matches AdminShell density |
| [`examples/data-table.tsx`](./examples/data-table.tsx) | `src/components/ui/data-table.tsx` | Generic typed `<DataTable rows columns getRowKey rowActions />` — legibility headers, hover rows, ellipsis row-action column |
| [`examples/empty-loading-states.tsx`](./examples/empty-loading-states.tsx) | `src/components/ui/states.tsx` | `<LoadingState />` / `<EmptyState icon action>` / `<ErrorState onRetry>` — empty state ALWAYS names CTA |
| [`examples/search-toolbar.tsx`](./examples/search-toolbar.tsx) | `src/components/ui/{search-input,toolbar}.tsx` | h-7 SearchInput (icon left + clear right), `<Toolbar left right>`, `<FilterChip active count>`, `<ResultCounter>` |
| [`examples/form-bits.tsx`](./examples/form-bits.tsx) | `src/components/ui/{label,field}.tsx` | `<Label>` (legibility default + editorial opt-in), `<Field>` (label/control/help/error), `<FormRow>` (two-column), `<Form>` (space-y-3) |
| [`examples/tabs.tsx`](./examples/tabs.tsx) | `src/components/ui/tabs.tsx` | Polaris underline tabs — `text-foreground/70` inactive, `border-b-2 border-primary` active, no pills, no shadow |
| [`examples/skeleton.tsx`](./examples/skeleton.tsx) | `src/components/ui/skeleton.tsx` | Pulse Skeleton primitive + `useDelayedFlag(loading, 200)` hook + `<SkeletonRow columns={5} />` for tables |
| [`examples/toast.tsx`](./examples/toast.tsx) | `src/components/ui/toast.tsx` | Sonner Toaster with Polaris theming + typed `toast.{success,error,info,warning,loading}` wrapper |
| [`examples/avatar-user-menu.tsx`](./examples/avatar-user-menu.tsx) | `src/components/ui/avatar.tsx` + `src/components/user-menu.tsx` | Square Avatar (initials in primary-tinted square) + sidebar-footer UserMenu with profile/settings/sign-out dropdown |
| [`examples/confirm-dialog.tsx`](./examples/confirm-dialog.tsx) | `src/components/ui/confirm-dialog.tsx` | `<ConfirmDialog>` 3-zone replacement for `window.confirm()`, plus `ConfirmProvider` + `useConfirm()` hook; supports `requireText` for "type X to confirm" |
| [`examples/tooltip-popover.tsx`](./examples/tooltip-popover.tsx) | `src/components/ui/{tooltip,popover}.tsx` | Tooltip (`bg-foreground text-background text-[11px]`) + `<Tip>` convenience wrapper + Popover (`bg-popover border-border shadow-md p-2`) |
| [`examples/list-crud-page.tsx`](./examples/list-crud-page.tsx) | Reference page (not a primitive) | Full list/CRUD page wiring every primitive — PageHeader + table + 3-zone create dialog + reveal dialog + loading/empty branches |

### Visual reference

- [`examples/SCREENSHOTS.md`](./examples/SCREENSHOTS.md) — ASCII mockups + observable rules for 6 canonical surfaces from sync_go (`/settings/api-keys` list-with-data, `/settings` profile, `/settings/workspaces` flat list, `/t/$tenantId/settings/members` empty state, `/sa` admin filter list, sidebar in detail). Each entry maps to which `examples/` primitives wire it up. Drop real PNGs into `examples/screenshots/<route>.png` if desired — the doc points there.

**Discovery rule for agents:** when the user says "build X page", first check if `examples/list-crud-page.tsx` matches the shape (list + create + row-actions). If yes — start from it. If the project's `Button` / `Input` / `Dialog` / `PageHeader` are off-spec, replace them from the matching `examples/` file BEFORE building the page. Patching around off-spec primitives is the #1 reason a page ends up looking broken.

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
