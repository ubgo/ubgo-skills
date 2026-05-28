# Repo structure

Quick map of how `ubgo-skills` is laid out, what each piece does, and where to put a new skill.

## Layout

```
ubgo-skills/
├── README.md              ← entry point; skills table + install instructions
├── CONTRIBUTING.md        ← contribution philosophy + flows + style rules
├── CHANGELOG.md           ← reverse-chrono log of skill changes
├── STRUCTURE.md           ← this file
├── LICENSE                ← MIT
├── .gitignore             ← node_modules, .env*, .DS_Store, *.log
└── skills/
    ├── ubgo-golang/
    │   ├── SKILL.md       ← YAML frontmatter + "how to load" + body pointer
    │   └── golang.md      ← the doctrine — 30+ sections
    ├── ubgo-golang-train/
    │   ├── SKILL.md
    │   └── TRAIN.md       ← writeback ritual for golang.md
    ├── ubgo-golang-learn/
    │   └── SKILL.md       ← bootstrap recipe for per-repo golang-project.md
    ├── ubgo-frontend/
    │   ├── SKILL.md
    │   └── frontend.md
    ├── ubgo-frontend-train/
    │   ├── SKILL.md
    │   └── TRAIN.md
    ├── ubgo-wails-desktop/
    │   ├── SKILL.md
    │   └── WAILS.md       ← topic-specific body file
    └── …
```

## Per-skill anatomy

### Required

- `SKILL.md` with YAML frontmatter:

  ```markdown
  ---
  name: ubgo-<topic>
  description: >-
    One-paragraph description that surfaces on every agent skill listing.
    Cover what the skill does, when it fires, and any trigger phrases.
  ---

  # ubgo-<topic>

  Brief intro. Pointer to the body file (`<topic>.md`). Listing of
  "when this skill fires" + "what it does NOT cover".
  ```

- A body file with the actual doctrine — name it after the topic (`golang.md`, `frontend.md`, `WAILS.md`, `TRAIN.md`). The body should be self-contained: a fresh reader with no other context should be able to apply the rules from it alone.

### Optional

- `examples/` — runnable references (rare; only when the rules need a working artifact to be unambiguous).
- Additional Markdown files (`OVERLAY-FORMAT.md`, `BENCHMARKS.md`) when one body file would be too dense.

## Three skill roles

| Role | Suffix | What it does | Lifecycle |
|---|---|---|---|
| **Rules** | (none) | The doctrine itself — `<topic>.md` is the rulebook. Consumed read-only at the start of any session touching the topic. | Long-lived. Edited by the corresponding `-train` skill or by direct PR. |
| **Train** | `-train` | Writeback loop. When loaded, makes the agent capture universal learnings BACK into the parent's rules body during real work. | Loaded on demand. Never edits overlays. |
| **Learn** | `-learn` | Bootstrap a per-repo overlay file (`<topic>-project.md`). | Loaded once per repo (or to refresh). Never edits canonical. |

A topic doesn't have to ship all three — `ubgo-wails-desktop` only has the rules role (it's deep but project-specific use is rare; no overlay or train flow needed yet).

## Canonical ↔ installed sync

Every skill lives in two physical places on any developer's machine:

```
canonical (single source of truth — edited by humans / train skills)
    skills-ai/ubgo-skills/skills/<name>/

installed (consumed by agents at runtime — synced FROM canonical)
    ~/.claude/skills/<name>/         (Claude Code)
    ~/.agents/skills/<name>/         (other agent harnesses)
    ~/.cursor/extensions/.../<name>/ (Cursor, if applicable)
    …                                (every agent has its own root)
```

**Never hardcode either path in skill bodies.** Discovery is runtime:

```bash
# canonical
find ~ /Volumes /Users -type d -name "ubgo-<name>" -path "*/ubgo-skills/skills/*" 2>/dev/null

# installed (every copy on this machine)
find ~ -type d -name "ubgo-<name>" 2>/dev/null | grep -v "/ubgo-skills/"
```

Train skills follow this ritual: discover canonical → edit canonical → sync canonical to every discovered installed copy → verify with `diff -q`. See `skills/ubgo-frontend-train/TRAIN.md` §0 + §5 for the canonical write-back ritual prose.

## Adding a new skill — minimum viable PR

1. Open an issue describing the topic + why it needs its own skill (see `CONTRIBUTING.md` §3).
2. Create `skills/ubgo-<topic>/SKILL.md` + `skills/ubgo-<topic>/<topic>.md`.
3. Update the README skills table.
4. Update `CHANGELOG.md` with the new skill name + one-line description.
5. PR.

Optional follow-ons (separate PRs):

- `skills/ubgo-<topic>-train/` with `SKILL.md` + `TRAIN.md` (template: `ubgo-golang-train`).
- `skills/ubgo-<topic>-learn/` with `SKILL.md` describing the multi-agent overlay-emission recipe (template: `ubgo-golang-learn`).

## Cross-skill references

Skills cross-reference each other by name (`see ubgo-frontend-train`), not by path. Never bake an absolute path to another skill's file into a body.

If two skills genuinely need to share a chunk of doctrine, extract a third meta-skill rather than duplicating — but only after the duplication has appeared in two real skills (not speculatively).
