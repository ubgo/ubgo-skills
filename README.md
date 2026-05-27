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

<table>
<tr><th width="220">Skill</th><th>What it does</th></tr>
<tr>
<td><a href="skills/ubgo-golang/"><code>ubgo-golang</code></a></td>
<td>Universal Go backend rules — stack, the 3 commandments (no bare strings, no hardcoded enums, no DB-level business validation), entpoly polymorphism, reference tables, DB-as-dumb-storage, logging/tracing, anti-pattern catalog, pre-PR checklist. Read before any Go change.</td>
</tr>
<tr>
<td><a href="skills/ubgo-golang-learn/"><code>ubgo-golang-learn</code></a></td>
<td>Learn a Go repo and emit a project-specific overlay (<code>golang-project.md</code>) that extends <code>ubgo-golang</code> with this repo's named constants, module layout, codegen task names, captured-in-blood gotchas, and workflow. Multi-agent targets (Claude / Cursor / Windsurf / Cline / Codex / Copilot / Gemini). Re-runnable.</td>
</tr>
<tr>
<td><a href="skills/ubgo-frontend/"><code>ubgo-frontend</code></a></td>
<td>Universal frontend rules — TanStack Start + Base UI (basecn) + Tailwind v4 + gqlkit SDK stack, the 5 commandments (no inline GraphQL, no <code>useEffect</code>-for-fetch, no native dialogs, no raw <code>&lt;select&gt;</code>, no Radix), design tokens (Fraunces + Geist + compact type scale), forms, data fetching, routing, dialogs/sheets, SSR safety (Nitro <code>localStorage</code> trap, barrel-cycle trap), keyboard dispatcher, hard-won traps, AND a long §29 <em>"Concrete UI patterns"</em> section with verbatim classNames for every primitive (buttons, inputs, forms, ServerDataTable, EntityShell, QuickView, chips/status pills, color + opacity ramps). Read before any <code>.tsx</code> / <code>.css</code> change.</td>
</tr>
<tr>
<td><a href="skills/ubgo-wails-desktop/"><code>ubgo-wails-desktop</code></a></td>
<td>Package an existing Go (Gin + gqlgen + oRPC + tRPC) backend and a Web SPA frontend (TanStack Start / Vite / Next-static / SvelteKit-static) into a single native macOS desktop binary using Wails — with ZERO TCP listeners at runtime. API calls ride the Wails IPC bridge into the existing Gin engine in-memory via <code>httptest.NewRecorder</code>. No backend or frontend rewrites.</td>
</tr>
</table>

## Conventions

- Skill directory + frontmatter `name` both use the `ubgo-` prefix.
- One `SKILL.md` per skill; supporting files (`golang.md`, `frontend.md`, etc.) allowed alongside it as the rules body when a skill grows past a single file.
- Skills are self-contained (no cross-skill imports).
- Rules-body skills (`ubgo-golang`, `ubgo-frontend`) expect a **project overlay** at `frontend-project.md` / `golang-project.md` (or under `.claude/rules/`, `.cursor/rules/`, etc.) that adds repo-specific specifics. Overlay overrides on conflict.
- When the project ships a knowledge-base CLI (`aicodermini`, `lore`, `codeskill`), the skill expects you to query its rules / hotfixes store before substantive work — those are authoritative over the skill body on conflict.

## Contributing

Pull requests welcome — especially for sharpening rules with real-world failure modes ("we hit X, here's the fix"). Keep the bar high:

- **One concern per skill.** If a rule doesn't belong to any existing skill, propose a new one (with the `ubgo-` prefix) rather than bloating an unrelated one.
- **Rules > vibes.** Every rule should answer *why* (the bug it prevents, the constraint it encodes). Drive-by stylistic preferences without a why get rejected.
- **Verbatim wins.** When codifying a pattern, quote real classNames / commands / file paths — not paraphrases.
- **No hard-wrapped markdown.** Prose runs as one physical line per paragraph; let the renderer wrap. Tables, fenced code, and YAML frontmatter are the only line-break exceptions.
- **Update the README table** when adding a skill.
- **Open an issue first** for larger reorgs (splitting a skill, renaming, restructuring the overlay convention).

To extend a skill with project-specific quirks for *your* repo, do NOT edit the universal rules — author a project overlay (`golang-project.md` / `frontend-project.md` at your repo root, or under `.claude/rules/` etc.) that the skill auto-discovers.

## License

[MIT](LICENSE) © khanakia. Use these skills freely in any project, public or private; attribution appreciated but not required.
