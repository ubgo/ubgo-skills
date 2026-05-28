# ubgo-frontend-train — body

The mechanics of writing a frontend lesson back into the canonical skill so future agents inherit it. Every real session that surfaces a universal-worthy lesson "trains" the skill — hence the name.

---

## 0 · Where things live (discovery, not hardcoded)

Two physical copies of every ubgo skill exist on any developer's machine:

| Copy | Role | Where to find it |
|---|---|---|
| **Canonical** | Source of truth — edit HERE | The `ubgo-skills` git repo on the maintainer's filesystem (path varies per developer). Locate via `find` (see below). |
| **Installed** | Active in current sessions; SYNC TO this after editing canonical | The agent's skill directory on this machine. For Claude Code that's typically under `~/.claude/skills/<skill-name>/`, but the actual path varies per agent + per OS. |

**Never hardcode either path in this file.** Discover at runtime — the right path differs per developer machine + per coding agent + per OS.

### Discovery order — try in this sequence, stop at first hit

1. **`find` the canonical** (the `ubgo-skills` git repo):

   ```bash
   find ~ /Volumes /Users -type d -name "ubgo-frontend" -path "*/ubgo-skills/skills/*" 2>/dev/null
   ```

   First match = canonical dir. If multiple match, the one inside `skills-ai/` or `ubgo-skills/` is canonical.

2. **`find` the installed copy** for whichever agent is running:

   ```bash
   find ~ -type d -name "ubgo-frontend" 2>/dev/null | grep -v "/ubgo-skills/"
   ```

   Likely candidates: `~/.claude/skills/ubgo-frontend/`, `~/.config/claude/skills/...`, `~/Library/Application Support/.../skills/...`, agent-specific paths.

3. **If discovery finds nothing or multiple equally-likely candidates** — `AskUserQuestion` for the right path:

   ```
   Where should I sync the updated skill to so this session picks it up?
   options: [each discovered candidate, plus "show me where to find it", plus "skip sync"]
   ```

4. **Cache the user's answer for the session** so subsequent edits don't re-prompt — store it in a chat memory or just remember it within the current turn.

The hardcoded sample paths that used to live here have been removed precisely because they're machine-specific.

---

## 1 · The decision tree — does this belong in canonical?

Before writing anything, walk this:

```
Did you learn something during frontend work?
├── Is it a NAMED FACT about THIS project? (file path, repo name, customer brand,
│   API endpoint, named constant, customer-specific design choice)
│   └── YES → project overlay (frontend-project.md). STOP here.
│
├── Is it a UNIVERSAL PATTERN any frontend repo would benefit from?
│   (a generic anti-pattern, a verbatim className that should be everywhere,
│   a mapping rule, a sharper trigger for an existing rule, a missing trap)
│   └── YES → canonical (frontend.md). Continue to §2 (where to write).
│
├── Is it a SESSION-SPECIFIC fix you wouldn't repeat on the next project?
│   (one-off bug repro, copy edit, transient API quirk)
│   └── YES → neither. Don't write. Mention in chat + move on.
│
└── UNCERTAIN?
    └── Default to overlay (project-specific is the safer mistake — it's
        easy to promote later; it's hard to demote a wrong universal rule).
```

**Test:** could you imagine an agent on a totally different frontend repo (different stack flavor, different industry, different design system) benefiting from this lesson? If yes → universal. If no → overlay.

---

## 2 · Where in `frontend.md` to write

Match the lesson to the existing section. Don't append a new top-level section unless the existing ones genuinely don't cover the topic.

| Lesson type | Target section |
|---|---|
| New banned thing (universal) | §0 commandments (only if it's a hard rule, no exceptions); otherwise §26 anti-pattern catalog |
| New library / stack swap | §1 stack table |
| New TypeScript pattern / type-safety gotcha | §2 |
| New GraphQL / codegen pattern | §3 |
| New component / primitive convention | §4 |
| New design-token rule / class verbatim | §5 (rules) or §29.X (verbatim shape) |
| New form pattern (TanStack Form / Zod / valgo) | §6 |
| New data-fetching pattern (TanStack Query) | §7 |
| New client-state pattern (TanStack Store) | §8 |
| New routing pattern (TanStack Router) | §9 |
| New dialog / sheet / drawer width trap | §10 |
| New table / list rule (datagrid, row actions, link rows) | §11 |
| New page-layout rule (PageHeader, wrappers) | §12 |
| New SSR safety trap | §13 |
| New auth pattern | §14 |
| New keyboard / shortcut rule | §15 |
| New mention / entity link | §16 |
| New media / file pattern | §17 |
| New toast / error / loading state | §18 |
| New icon / image / animation rule | §19 |
| New a11y rule | §20 |
| New lint / format setup | §21 |
| New performance rule | §22 |
| New testing pattern | §23 |
| New commit / repo hygiene | §24 |
| New AI-behavior taste | §25 |
| New verbatim UI pattern (className strings, exact shape) | §29.X (find or create the right subsection) |
| New banned shape with universal applicability | §26 anti-pattern catalog (always add a row when you add a new rule elsewhere — keep §26 the single index) |

**Most lessons land in TWO places:** the rule's home section (e.g. §11) AND a one-line entry in §26 anti-pattern catalog cross-referencing back to the home section. Don't skip the §26 row — it's the discoverability index.

---

## 3 · What to write — the format

### Universal rule (§0–§28)

A short, opinionated rule + a one-line reason + a code snippet + a "verify by" command if applicable.

```markdown
### <rule heading>

**Hard rule.** <one-sentence statement of the rule.>

<one-paragraph reason — why we hit this; what breaks without it.>

```tsx
// canonical shape
<X>...</X>
```

**Verify by:** `<command that catches violations>` (when relevant).
```

### Verbatim UI pattern (§29.X)

A concrete className string + dimensions + a copy-paste tsx block. No prose unless explaining a non-obvious choice.

```markdown
### 29.X · <thing>

```
<exact className tokens, one per line if long>
```

```tsx
<concrete JSX example>
```

**Use when:** <one-liner trigger>. **Don't use when:** <one-liner anti-trigger>.
```

### Anti-pattern (§26)

One table row:

```markdown
| <anti-pattern in one phrase> | <why banned in one sentence> | <what to do instead, with §X cross-ref> |
```

### Pre-PR checklist (§27)

One bullet per new rule, in the matching §X position:

```markdown
- [ ] §X — <one-line check the agent can grep / eyeball before declaring done>
```

---

## 4 · Voice rules

- **Imperative, present tense.** "Use X" not "you should use X" not "it is recommended to use X".
- **Concrete > abstract.** Show the exact className, not "use compact spacing".
- **Cite the failure mode.** Every rule earns its existence by stating what breaks without it.
- **No hedging.** "Default to X" not "consider X". Skill content is doctrine; chat replies can hedge.
- **One physical line per prose paragraph.** Tables, fences, frontmatter are exceptions. Renderers reflow; don't manually wrap.
- **Lucide-only.** Don't introduce mixed icon libraries in code examples.
- **No customer / repo names.** Universal means universal — names go in overlays.
- **No machine-specific paths.** Discovery > hardcode (see §0).

---

## 5 · The write-back ritual

```
1. Discover (or ask for) the canonical + installed paths per §0.
2. Edit the canonical frontend.md at the discovered canonical path.
3. Sync canonical → installed copy at the discovered installed path.
4. Verify identical: `diff -q <canonical> <installed>` — expect no output.
5. If the new rule lives in BOTH §X home + §26 catalog (recommended), grep
   for the keyword in canonical — expect 2+ hits.
6. Tell the user what you wrote + where, in one or two sentences.
```

If the project vendors the skill into the repo (e.g. via `repolink` symlinks, git-submodule, or copy-on-clone), also propagate to those copies. Find them with the same `find` from §0, then `cp` each one. Don't assume — confirm with the user when in doubt.

---

## 6 · Quality bar (when to NOT write)

Skip the write-back if any of these hold:

- The lesson is project-specific (file path, customer name, repo-only convention) → overlay instead
- The rule conflicts with an existing rule and you haven't reconciled them in the same edit
- You're "improving" an existing rule with prose alone — add a code snippet or an anti-pattern row or it doesn't earn its place
- The rule exists already and you're just rewording — propose the rewording in chat, get sign-off, then edit (rewording the skill body without acknowledgment confuses future diffs)
- You're tempted to add a §29.X subsection for a one-off design choice — wait for the second occurrence; that proves it's a pattern
- The rule duplicates content already in `ubgo-golang` or another sibling skill — link, don't restate

**Two-occurrence rule:** for verbatim UI patterns (§29.X) — generally don't promote until you've written the same shape twice across different pages. Once may be coincidence; twice is a pattern.

**Exception:** hard rules (`NEVER X`) can be promoted on first occurrence if the failure mode is severe (data loss, security, broken accessibility).

---

## 7 · Reconciling conflicts

If a new lesson conflicts with an existing rule:

1. **Re-read the existing rule + its failure mode.** Is the new lesson a sharper version or a different case?
2. **Sharper version:** edit the existing rule in place; expand its failure-mode description; add an exception clause if needed.
3. **Different case:** add a new subsection / row that says "in <scenario A> use X; in <scenario B> use Y; tell them apart by <test>."
4. **Genuine contradiction:** flag in chat + leave the skill untouched until reconciled with the maintainer.

The §29.2 button-size rewrite is a worked example of "different case" handling (project ships compact-default vs shadcn-baseline — two mapping tables, one rule).

---

## 8 · Worked examples

### Example A — caught a list page using bare `<Table>`

**Lesson:** every list page should use the project's full datagrid (ServerDataTable / DataTable), not bare `<table>` / `<TR>` — too many features get rebuilt per page otherwise.

**Where it landed:**

- §11 — expanded with "NEVER bare `<table>` for a list page" hard rule + verbatim ServerDataTable shape
- §26 — new row: `Bare <Table> + .map(row → <TR>) on a list page | No sort/filter/search/pagination/saved-views/etc | Use project datagrid (verify with grep)`

**Why universal:** the failure mode (rebuilding sort/filter/search per page) is independent of stack flavor; every CRUD app hits it.

### Example B — caught button size mismatch between ubgo prescription and shadcn baseline

**Lesson:** ubgo prescribes `default = h-8` but shadcn/basecn ship `default = h-9` — mapping must be explicit per project's button.tsx.

**Where it landed:**

- §29.2 — completely rewritten with two mapping tables (compact-default vs shadcn-baseline) + a "verify by DevTools height = 32px for chrome" rule + mismatch-audit checklist
- §26 — new row cross-referencing §29.2

**Why universal:** every basecn / shadcn project hits this; the mapping rule is the fix regardless of project.

### Example C — caught a project-specific named constant

**Lesson:** in this sync_go project, channel kindCode "shopify" should render with emerald chip color.

**Where it landed:** **NOT canonical.** This is a project-specific design choice. Belongs in `<repo>/.claude/rules/frontend-project.md` as a `KIND_TONE` mapping table or `CHANNEL_KIND_COLORS` overlay.

**Why not universal:** the next project might have totally different channel kinds with totally different brand colors. Promoting this to canonical would clutter the skill with one customer's taste.

---

## 9 · Failure modes to avoid

| Mistake | Why it's bad | Fix |
|---|---|---|
| Adding a rule without a code snippet | "Use compact spacing" doesn't tell anyone what to type | Always include exact classNames / tsx |
| Adding to §X home without §26 catalog row | §26 is the discoverability index — agents grep there first | Always do BOTH edits in one pass |
| Writing back universal-sounding rules that name a customer | Locks one customer's reality into doctrine | Names go in overlays |
| Hardcoding sync paths instead of discovering them | Doctrine baked to one developer's machine; doesn't port | §0 discovery order — `find` or ask |
| Editing canonical without syncing installed | This session's loaded skill stays out-of-date | Sync after edit; verify with `diff -q` |
| Adding a §29.X for a one-off page | Inflates the verbatim-pattern catalog with noise | Wait for the second occurrence (§6 two-occurrence rule) |
| Hedge words ("consider", "should probably", "might want") | Skill body is doctrine, not advice | Imperative present tense always |
| Hard-wrapping prose in markdown | Maintainer's global no-hard-wrap rule; tooling reflows | One physical line per paragraph |
| Adding a new top-level section when an existing one covers it | Skill grows incoherent | Match the §X table in §2; only add a new section if genuinely uncovered |
| Skipping the "verify by" command | Future agents can't audit | Add a grep / DevTools / build command that catches violations |

---

## 10 · Self-improvement of THIS skill

If you (the agent applying this skill) learn something about how to capture lessons better — write that back here too. This skill is also trained by use.

Same path-discovery rules from §0 apply: don't hardcode where `TRAIN.md` lives; discover via `find … -name "ubgo-frontend-train"`, sync to the installed copy at the discovered location, verify with `diff -q`.
