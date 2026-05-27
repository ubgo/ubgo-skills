# ubgo-skills

A personal library of agent skills capturing my Golang and frontend conventions. Every skill is namespaced with the `ubgo-` prefix (e.g. `ubgo-golang`) so the collection scales without name collisions.

Each skill lives in its own directory under `skills/` containing a `SKILL.md` with YAML frontmatter (`name`, `description`) plus instructions. Works with Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini, Cline, and others.

## Install

Via [skills.sh](https://www.skills.sh/) (the open-source `skills` CLI):

```bash
# install the whole collection
npx skills add khanakia/ubgo-skills

# or browse first
npx skills
```

Then restart your agent (or reload skills) and invoke a skill by its frontmatter `name`.

## Skills

| Skill | What it does |
|---|---|
| `ubgo-golang` | Universal Go backend rules — stack, the 3 commandments, entpoly, reference tables, DB-as-dumb-storage, logging/tracing, anti-patterns. Read before any Go change. |
| `ubgo-golang-learn` | Learn a Go repo and emit a project-specific overlay (`golang-project.md`) that extends `ubgo-golang` with this repo's constants, layout, codegen, gotchas. Multi-agent targets (Claude / Cursor / Windsurf / Cline / Codex / Copilot / Gemini). Re-runnable. |

## Conventions

- Skill directory + frontmatter `name` both use the `ubgo-` prefix.
- One `SKILL.md` per skill; supporting files allowed alongside it.
- Skills are self-contained (no cross-skill imports).
