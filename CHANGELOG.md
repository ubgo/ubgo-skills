# Changelog

Notable changes to skills in this repo. Format: reverse-chronological, grouped by skill, terse bullet per change. No semver pinning yet — this is a running log of what shifted and why, so consumers diffing across `npx skills update` can see what's new.

## 2026-05-28

### `ubgo-frontend`

- **§11 Tables & lists — major expansion.** Hard rule: NEVER bare `<table>` for a list page; always the project's full datagrid (ServerDataTable / DataTable / equivalent). Added verbatim ~70-line ServerDataTable canonical shape with `cols + filterFields + sortOptions + rowActions + queryFn`. New rule: per-row actions via the `rowActions` prop dropdown, not a custom Actions column. Conditional rule: row-as-`<Link>` only when the entity has a detail page.
- **§26 anti-pattern catalog.** New row: "Bare `<table>` + `.map(row → <TR>)` on a list page" → "use project datagrid".
- **§29.2 Button system — rewritten.** Replaced single sizes table with TWO mapping tables (compact-default vs shadcn-baseline) — the prescribed `default = h-8` doesn't match shadcn/basecn's shipped `default = h-9`. Added "Verify by DevTools height = 32px for chrome" rule + mismatch-audit checklist. New §26 row: "Button at default size in shadcn-baseline project renders oversized".
- Removed hardcoded path callout from authoring header — training mandate now lives only in `ubgo-frontend-train`.

### `ubgo-golang`

- Removed hardcoded path callout from authoring header — training mandate now lives only in `ubgo-golang-train`.

### `ubgo-frontend-train` (NEW)

- Training loop skill for `ubgo-frontend`. Decision tree (universal / overlay / noise), section-targeting table, format templates for rules + anti-patterns + checklist bullets, voice rules, write-back ritual with runtime path discovery (no hardcoded paths), quality bar with two-occurrence rule, conflict reconciliation, three worked examples, failure-modes table.

### `ubgo-golang-train` (NEW)

- Sibling training loop for `ubgo-golang`. Same shape as `ubgo-frontend-train`; targets `golang.md` instead of `frontend.md`. Section-targeting table maps to golang.md §0–§31. Worked examples include entpoly polymorphism, `field.Enum` → reference tables, migration trap.

### Repo

- README rewritten with "Skill families" section explaining rules / train / learn three-role split.
- CONTRIBUTING.md added — philosophy, contribution flows, style rules, two-occurrence rule, PR checklist, when NOT to contribute, reorg policy.
- STRUCTURE.md added — repo layout + per-skill anatomy + canonical/installed sync flow.
- CHANGELOG.md added (this file).

---

## Earlier

History before this changelog landed lives in `git log skills/<name>/`. The TL;DR of each skill's origin:

- `ubgo-golang` + `ubgo-golang-learn` — extracted from the sync_go (Risify Sync v3) project's hand-maintained `golang.md` + `golang-project.md` overlay. First skill family.
- `ubgo-frontend` — extracted from the sync_tanstack frontend conventions, paired with the same overlay pattern.
- `ubgo-wails-desktop` — captured from a real Wails + Gin + TanStack-Start integration with empirical benchmarks.
