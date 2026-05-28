# ubgo-skills

A personal library of agent skills capturing my Go and frontend conventions. Every skill is namespaced with the `ubgo-` prefix (e.g. `ubgo-golang`) so the collection scales without name collisions.

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

## Skill families

Skills come in three roles that map cleanly to the read / write / bootstrap split:

| Role | Naming | What it does | Loaded when |
|---|---|---|---|
| **Rules** | `ubgo-<topic>` | The doctrine itself — read-side. Stack, anti-patterns, verbatim patterns. | Before any substantive work on that topic. |
| **Train** | `ubgo-<topic>-train` | Maintenance loop — write-side. Captures universal lessons back into the canonical rules body. | When the user (or the agent itself) wants the rules to keep improving from real-session experience. |
| **Learn** | `ubgo-<topic>-learn` | Bootstrap a per-repo overlay file (`<topic>-project.md`) that extends the universal rules with this repo's named constants, gotchas, workflow. | When standing up agent rules in a new repo or refreshing an existing overlay. |

The three roles are independent — loading the `train` skill doesn't auto-train; it just makes the writeback mandate operational when applicable. Loading the `learn` skill doesn't auto-write an overlay; it gives you the recipe + multi-agent target paths.

## Skills

<table>
<tr><th width="200">Skill</th><th>What it does</th></tr>

<tr>
<td><a href="skills/ubgo-golang/"><code>ubgo-golang</code></a></td>
<td>Universal Go backend rules — stack choices, the 3 commandments (no bare strings, no hardcoded enums, no DB-level business validation), entpoly polymorphism, reference tables, DB-as-dumb-storage, logging (<code>lace/gozap</code>), tracing (<code>lace/gotel</code>), <code>valgo</code> validation, concurrency/defer/time/HTTP/context.Value/constructors traps, migration discipline, anti-pattern catalog, pre-PR checklist. Read before any Go change.</td>
</tr>

<tr>
<td><a href="skills/ubgo-golang-train/"><code>ubgo-golang-train</code></a></td>
<td>Training loop for <code>ubgo-golang</code>. Captures universal Go learnings from real sessions back into the canonical <code>golang.md</code>. Decision tree for universal vs project vs noise, section-targeting table, voice rules, conflict reconciliation, path-discovery sync ritual. The skill gets smarter every session it's loaded.</td>
</tr>

<tr>
<td><a href="skills/ubgo-golang-learn/"><code>ubgo-golang-learn</code></a></td>
<td>Bootstrap a Go repo's project overlay (<code>golang-project.md</code>) that extends the universal rules with this repo's named constants, module layout, codegen task names, captured-in-blood gotchas, and workflow. Multi-agent targets (Claude / Cursor / Windsurf / Cline / Codex / Copilot / Gemini). Re-runnable.</td>
</tr>

<tr>
<td><a href="skills/ubgo-frontend/"><code>ubgo-frontend</code></a></td>
<td>Universal frontend rules — TanStack Start + Base UI (basecn) + Tailwind v4 + gqlkit SDK stack, the 5 commandments (no inline GraphQL, no <code>useEffect</code>-for-fetch, no native dialogs, no raw <code>&lt;select&gt;</code>, no Radix), design tokens (Fraunces + Geist + compact type scale), forms (TanStack Form + Zod), data fetching (TanStack Query), routing, dialogs/sheets, SSR safety (Nitro <code>localStorage</code> trap, barrel-cycle trap), keyboard dispatcher, hard-won traps, AND a long §29 <em>"Concrete UI patterns"</em> section with verbatim classNames for every primitive (buttons with two-table sizing mapping for compact-default vs shadcn-baseline projects, inputs, forms, ServerDataTable, EntityShell, QuickView, chips/status pills, color + opacity ramps). Read before any <code>.tsx</code> / <code>.css</code> change.</td>
</tr>

<tr>
<td><a href="skills/ubgo-frontend-train/"><code>ubgo-frontend-train</code></a></td>
<td>Training loop for <code>ubgo-frontend</code>. Same shape as <code>ubgo-golang-train</code> but targets <code>frontend.md</code>. Captures universal UI/UX learnings (datagrid-not-bare-table, button-size mapping, dialog-width gotcha, etc.) back into the canonical body. Includes worked examples and a quality bar with the two-occurrence rule for §29 verbatim patterns.</td>
</tr>

<tr>
<td><a href="skills/ubgo-wails-desktop/"><code>ubgo-wails-desktop</code></a></td>
<td>Package an existing Go (Gin + gqlgen + oRPC + tRPC) backend and a Web SPA frontend (TanStack Start / Vite / Next-static / SvelteKit-static) into a single native macOS desktop binary using Wails — with ZERO TCP listeners at runtime. API calls ride the Wails IPC bridge into the existing Gin engine in-memory via <code>httptest.NewRecorder</code>. No backend or frontend rewrites; only a <code>fetch</code>-shaped transport swap via a <code>bridgeFetch</code> shim. Captures every gotcha from a real integration (Wails CLI vs Go workspace, macOS framework linker flags, TanStack Start <code>_shell.html</code> rename, <code>config.Get</code> CWD trap, DevTools build tags, base64 IPC overhead, vendor regeneration, Wails 2.8.1 <code>mac.Options</code> surface).</td>
</tr>
</table>

## Conventions

- Skill directory + frontmatter `name` both use the `ubgo-` prefix.
- One `SKILL.md` per skill; supporting files (`golang.md`, `frontend.md`, `TRAIN.md`, etc.) allowed alongside it as the rules body when a skill grows past a single file.
- Skills are self-contained (no cross-skill imports); related skills cross-reference by name in their bodies.
- **Rules-body skills** (`ubgo-golang`, `ubgo-frontend`) expect a **project overlay** at `frontend-project.md` / `golang-project.md` (or under `.claude/rules/`, `.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, `.codex/rules/`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`) that adds repo-specific specifics. Overlay overrides on conflict.
- **Train skills** never edit overlays; they edit the canonical rules body. Discovery-first — paths are found via `find` or asked for at runtime, never hardcoded.
- **Learn skills** never edit canonical; they emit per-repo overlays in the format the target agent reads.
- When the project ships a knowledge-base CLI (`aicodermini`, `lore`, `codeskill`), the skill expects you to query its rules / hotfixes store before substantive work — those are authoritative over the skill body on conflict.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: rules earn their place by citing the failure mode they prevent, verbatim shapes win over paraphrase, no hard-wrapped markdown, update the README table when adding a skill, open an issue first for reorgs.

## License

[MIT](LICENSE) © khanakia. Use these skills freely in any project, public or private; attribution appreciated but not required.
