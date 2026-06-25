# Changelog

Notable changes to skills in this repo. Format: reverse-chronological, grouped by skill, terse bullet per change. No semver pinning yet — this is a running log of what shifted and why, so consumers diffing across `npx skills update` can see what's new.

## 2026-06-23

### `ubgo-gomod-false-positive` (NEW)

- Diagnostic playbook for the gopls false positive **"X is not in your go.mod file"** (plus `malformed module path: missing dot` and `go.work requires go >= X (running go Y)`) in `go.work` multi-module workspaces, when `go build`/`go list` pass clean. Extracted from a real multi-hour debugging session on the sync_go monorepo.
- Golden rules: build-passing-but-gopls-erroring = tooling not code; reproduce with `gopls check <file>` before touching anything; the squiggled file is often NOT where the fix lives; `go work sync`→`go work vendor`→restart-gopls discipline; tidy-prunes-vs-sync-adds.
- **Seven** stacked root causes, each with detect + fix: **(A) toolchain skew** — system `go` older than `go.work`'s directive; gopls forces `GOTOOLCHAIN=local` so it ignores the auto-downloaded toolchain → whole workspace fails to load → every symbol errors. Real fix = upgrade the system go (the `go.goroot`/`go.alternateTools` editor stopgap proved unreliable for the live server). **(B)** missing `replace` for dotless local modules (zero-pseudo-version pattern; error shows on the dependent module, not the missing one). **(C)** dependency version skew (`go get @version`; `go work sync` REVERTS it). **(D)** root `vendor/` (red herring for C/F). **(E)** `go`-directive mismatch across modules. **(F)** old gopls (v0.21.1) mishandling pruned-graph + local `replace` → upgrade to ≥ v0.22.0. **(G)** workspace graph desync — a single-module remote dep (often pseudo-versioned, or surfaced right after restructuring modules into `modules/`) that builds green with B–F all ruled out; `go work sync`→`go work vendor`→restart-gopls reconciles the workspace graph (added 2026-06-25; note it can flip clean even while the dep's hash is still absent from `go.work.sum`, so don't gate the diagnosis on that file).
- Emphasis corrected after the real-session resolution: **fixes are versions (toolchain ≥ go.work, gopls ≥ v0.22.0, align the replaced module's deps), not go.mod surgery.** A "What does NOT work" section documents the dead ends — `GOFLAGS=-mod=mod` (rejected by the live server in workspace mode), blank-import `deps.go` whack-a-mole, `GOWORK=off`, and removing the root vendor.
- Copy-paste fast-triage block + a "why this is confusing" meta-lesson (causes stack; A masks C+F; build stays green throughout).

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
