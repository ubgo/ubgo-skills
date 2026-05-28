# ubgo-golang-train — body

The mechanics of writing a Go backend lesson back into the canonical skill so future agents inherit it. Every real session that surfaces a universal-worthy lesson "trains" the skill — hence the name.

Sibling to `ubgo-frontend-train` — same shape, different target (`golang.md` instead of `frontend.md`).

---

## 0 · Where things live (discovery, not hardcoded)

Two physical copies of every ubgo skill exist on any developer's machine:

| Copy | Role | Where to find it |
|---|---|---|
| **Canonical** | Source of truth — edit HERE | The `ubgo-skills` git repo on the maintainer's filesystem (path varies per developer). Locate via `find` (see below). |
| **Installed** | Active in current sessions; SYNC TO this after editing canonical | The agent's skill directory on this machine. For Claude Code that's typically `~/.claude/skills/<skill-name>/`; on this maintainer's machine there's also a parallel `~/.agents/skills/<skill-name>/` root. Actual path varies per agent + per OS. |

**Never hardcode either path in this file.** Discover at runtime — the right path differs per developer machine + per coding agent + per OS.

### Discovery order — try in this sequence, stop at first hit

1. **`find` the canonical** (the `ubgo-skills` git repo):

   ```bash
   find ~ /Volumes /Users -type d -name "ubgo-golang" -path "*/ubgo-skills/skills/*" 2>/dev/null
   ```

   First match = canonical dir. If multiple match, the one inside `skills-ai/` or `ubgo-skills/` is canonical. Edit `golang.md` inside that dir.

2. **`find` every installed copy** (could be 1, could be N — sync to ALL):

   ```bash
   find ~ -type d -name "ubgo-golang" 2>/dev/null | grep -v "/ubgo-skills/"
   ```

   Likely candidates: `~/.claude/skills/ubgo-golang/`, `~/.agents/skills/ubgo-golang/`, `~/.config/claude/skills/...`, `~/Library/Application Support/.../skills/...`, vendored copies in any repo using `repolink` or a similar share mechanism.

3. **If discovery finds nothing or multiple equally-likely candidates** — `AskUserQuestion` for the right path(s):

   ```
   Where should I sync the updated skill to so this session picks it up?
   options: [each discovered candidate, plus "show me where to find it", plus "skip sync"]
   ```

4. **Cache the user's answer for the session** so subsequent edits don't re-prompt — store it in chat context or remember within the current turn.

The hardcoded sample paths that used to live in earlier drafts of this file have been removed precisely because they're machine-specific.

---

## 1 · The decision tree — does this belong in canonical?

Before writing anything, walk this:

```
Did you learn something during Go backend work?
├── Is it a NAMED FACT about THIS project? (file path, repo name, module
│   layout, named constant, customer-specific channel/tenant code,
│   project-specific DB name / migration command / Taskfile recipe)
│   └── YES → project overlay (golang-project.md, via ubgo-golang-learn). STOP here.
│
├── Is it a UNIVERSAL PATTERN any Go repo would benefit from?
│   (a generic anti-pattern, a verbatim service pattern, a mapping rule, a
│   sharper trigger for an existing rule, a missing trap, a codegen gotcha
│   that's not project-specific, a stack-wide library prescription)
│   └── YES → canonical (golang.md). Continue to §2 (where to write).
│
├── Is it a SESSION-SPECIFIC fix you wouldn't repeat on the next project?
│   (one-off bug repro, copy edit, transient ent-codegen quirk that got
│   fixed upstream)
│   └── YES → neither. Don't write. Mention in chat + move on.
│
└── UNCERTAIN?
    └── Default to overlay (project-specific is the safer mistake — it's
        easy to promote later; it's hard to demote a wrong universal rule).
```

**Test:** could you imagine an agent on a totally different Go repo (different domain, different stack flavor, different DB) benefiting from this lesson? If yes → universal. If no → overlay.

---

## 2 · Where in `golang.md` to write

Match the lesson to the existing section. Don't append a new top-level section unless the existing ones genuinely don't cover the topic.

| Lesson type | Target section |
|---|---|
| New banned thing (universal hard rule) | §0 commandments (only if it's truly no-exceptions); otherwise §30 anti-pattern catalog |
| New library / stack swap | §1 stack table |
| New typed-constant pattern / bare-string gotcha | §2 |
| New polymorphic / entpoly pattern | §3 |
| New reference-table shape (vs `field.Enum`) | §4 |
| New DB-as-dumb-storage rule (triggers, hardening SQL) | §5 |
| New error-wrap / sentinel-error pattern | §6 |
| New context plumbing rule | §7 |
| New naming / package convention | §8 |
| New service / package design rule (DI, focus, panic policy) | §9 |
| New logging pattern (`lace/gozap` shape) | §10 |
| New tracing pattern (`lace/gotel` / OTEL) | §11 |
| New ent-specific gotcha (field constants, sensitive fields, FK policy, comments) | §12 |
| New validation pattern (`valgo` block, layer placement) | §13 |
| New file / resource key rule (lowercase, ASCII) | §14 |
| New testing pattern (table-driven, ent in-memory, mocking) | §15 |
| New codegen-helper-needs-runnable-example rule | §16 |
| New concurrency rule (goroutine lifecycle, channel ownership, sync primitives) | §17 |
| New defer pattern / Close-error gotcha | §18 |
| New time-handling trap (zones, monotonic clock, `time.Sleep`) | §19 |
| New receiver / nil-interface gotcha | §20 |
| New HTTP client rule (timeouts, body drain, transport tuning) | §21 |
| New `context.Value` rule (typed keys, request-scoped data only) | §22 |
| New constructor pattern (functional options, `iota`, named returns) | §23 |
| New tooling / module-hygiene rule (gofmt, vet, staticcheck, `init()`, `replace`) | §24 |
| New JSON / encoding / random rule (`omitempty` footgun, `crypto/rand`) | §25 |
| New composition-over-embedding rule | §26 |
| New secret-handling rule | §27 |
| New migration-discipline rule (backup, atlas, ent drop-column-false) | §28 |
| New documentation-where-the-code-is rule | §29 |
| New banned shape with universal applicability | §30 anti-pattern catalog (always add a row when you add a new rule elsewhere — keep §30 the single index) |
| New pre-PR check that ties to a §X rule | §31 pre-PR checklist (matched bullet per §X) |

**Most lessons land in TWO places:** the rule's home section (e.g. §3 entpoly) AND a one-line entry in §30 anti-pattern catalog cross-referencing back to the home section. Don't skip the §30 row — it's the discoverability index. If the rule has a verifiable check, also add a §31 checklist bullet.

---

## 3 · What to write — the format

### Universal rule (§0–§29)

A short, opinionated rule + a one-line reason + a code snippet + a "verify by" command if applicable.

```markdown
### <rule heading>

**Hard rule.** <one-sentence statement of the rule.>

<one-paragraph reason — why we hit this; what breaks without it.>

```go
// canonical shape
func DoThing(ctx context.Context, in Input) error { ... }
```

**Verify by:** `<grep / build / test command that catches violations>` (when relevant).
```

### Anti-pattern (§30)

One table row:

```markdown
| <anti-pattern in one phrase> | <why banned in one sentence> | <what to do instead, with §X cross-ref> |
```

### Pre-PR checklist (§31)

One bullet per new rule, in the matching §X position:

```markdown
- [ ] §X — <one-line check the agent can grep / eyeball / run before declaring done>
```

---

## 4 · Voice rules

- **Imperative, present tense.** "Use X" not "you should use X" not "it is recommended to use X".
- **Concrete > abstract.** Show the exact `ent.…` predicate, the exact `valgo.…` chain, the exact error-wrap format — not "validate inputs properly".
- **Cite the failure mode.** Every rule earns its existence by stating what breaks without it.
- **No hedging.** "Default to X" not "consider X". Skill content is doctrine; chat replies can hedge.
- **One physical line per prose paragraph.** Tables, fences, frontmatter are exceptions. Renderers reflow; don't manually wrap.
- **No customer / repo names in canonical.** Universal means universal — `bad-no`, `ana_sync2026_db`, `team_badno2`, project-named entity constants — those go in overlays.
- **No machine-specific paths.** Discovery > hardcode (see §0).
- **Cite project rules when relevant** — e.g. `rul_019e4f29` (DB as dumb storage) when stating the no-DB-triggers rule — these give future readers an authoritative cross-link.

---

## 5 · The write-back ritual

```
1. Discover (or ask for) the canonical + every installed path per §0.
2. Edit the canonical golang.md at the discovered canonical path.
3. Sync canonical → each installed copy at the discovered installed path(s).
4. Verify identical: `diff -q <canonical> <each-installed>` — expect no output.
5. If the new rule lives in BOTH §X home + §30 catalog (recommended), grep
   for the keyword in canonical — expect 2+ hits.
6. If a §31 checklist bullet was added, grep for it in the §31 block too.
7. Tell the user what you wrote + where, in one or two sentences.
```

If the project vendors the skill into the repo (e.g. via `repolink` symlinks, git-submodule, or copy-on-clone), also propagate to those copies. Find them with the same `find` from §0, then sync each. Don't assume — confirm with the user when in doubt.

---

## 6 · Quality bar (when to NOT write)

Skip the write-back if any of these hold:

- The lesson is project-specific (file path, customer name, DB name, repo-only convention) → overlay instead (via `ubgo-golang-learn`)
- The rule conflicts with an existing rule and you haven't reconciled them in the same edit
- You're "improving" an existing rule with prose alone — add a code snippet or an anti-pattern row or it doesn't earn its place
- The rule exists already and you're just rewording — propose the rewording in chat, get sign-off, then edit (rewording the skill body without acknowledgment confuses future diffs)
- The rule duplicates content in a sibling skill (`ubgo-frontend`, `ubgo-wails-desktop`) — link, don't restate
- The "lesson" is a transient upstream bug (ent codegen quirk, gqlgen version-specific) that will likely be fixed — wait for the second occurrence
- The lesson would benefit from being captured in `lore` / `aicoder` instead (project-scoped tribal knowledge) — route there

**Two-occurrence rule:** for nuanced patterns (something more than a simple "do X") — generally don't promote until you've written the same shape twice across different files or different sessions. Once may be coincidence; twice is a pattern.

**Exception:** hard rules (`NEVER X`) can be promoted on first occurrence if the failure mode is severe (data loss, security, broken DB migration, irreversible drift).

---

## 7 · Reconciling conflicts

If a new lesson conflicts with an existing rule:

1. **Re-read the existing rule + its failure mode.** Is the new lesson a sharper version or a different case?
2. **Sharper version:** edit the existing rule in place; expand its failure-mode description; add an exception clause if needed.
3. **Different case:** add a new subsection / row that says "in <scenario A> use X; in <scenario B> use Y; tell them apart by <test>."
4. **Genuine contradiction:** flag in chat + leave the skill untouched until reconciled with the maintainer.

Worked precedent: the `ubgo-frontend` §29.2 button-size rewrite (sibling skill) used the "different case" handling — project ships compact-default vs shadcn-baseline became two mapping tables under one rule.

---

## 8 · Worked examples

### Example A — caught a polymorphic table that hand-rolled `owner_kind` + `owner_id`

**Lesson:** every polymorphic relation in our Go projects uses `entpoly` — hand-rolled enum-discriminator + opaque id columns drift from real ent types, lose typed setters, and create migration pain (column rename + data backfill) the moment a new owner type joins.

**Where it landed:** §3 — entpoly polymorphic section with `MorphMixin + MixinAllowed + MixinIndexName` verbatim shape, migration recipe (pre-flight SQL: drop old unique index → backfill `owner_type` from `owner_kind` → drop column), §30 anti-pattern row, §31 pre-PR bullet ("every new polymorphic relation uses entpoly").

**Why universal:** the failure mode (drift between discriminator strings and ent type names; manual remap on schema evolution) is independent of which entities are polymorphic — every Go repo with ent + polymorphism hits it.

### Example B — caught `field.Enum` baked in schema

**Lesson:** user-facing taxonomy (status, kind, attribute input type, …) belongs in reference tables, not `field.Enum`. `field.Enum` requires a migration to add a value and can't be tenant-scoped; reference tables grow at runtime + support per-tenant overrides.

**Where it landed:** §4 — reference-table shape with `RefTableMixin` pattern, scope-tuple `team_id NULL=global / set=tenant` rule, app-layer validation helper signature, §30 anti-pattern row cross-referencing §4.

**Why universal:** the migration cost + tenancy limitation of `field.Enum` is independent of project scope — every multi-tenant Go app with growing enumerations hits it.

### Example C — caught a project-specific named constant

**Lesson:** in this sync_go project, `ownerKindCollection` should be sourced from `string(ent.CollectionMorphKey)`, not the legacy `enum.PassthroughOwnerCollection`.

**Where it landed:** **NOT canonical.** This is a project-specific named constant. Belongs in `<repo>/.claude/rules/golang-project.md` "Named constants — what already exists, do NOT reinvent" table.

**Why not universal:** the next project might not have collections, might not use entpoly's CollectionMorphKey, might use entirely different morph-key names. Promoting this would clutter the skill with one project's reality.

### Example D — caught a migration trap

**Lesson:** ent migrate ships with `WithDropColumn(false)` as the project default — adding a column then renaming it later leaves the old column lingering with its NOT NULL constraint, breaking inserts with "null value violates not-null constraint" on the abandoned column. Pre-flight SQL must DROP the column manually before running migrate.

**Where it landed:** §28 (Migration discipline) — added a "ent migrate caveats" subsection with the three default flags (`WithDropColumn(false)`, `WithDropIndex(false)`, `WithForeignKeys(false)`) and what each one means for migration planning; §30 anti-pattern row about "trusting migrate to clean up after a column rename"; §31 checklist bullet "if column was renamed in schema, verify old column dropped in pre-flight SQL".

**Why universal:** the ent default is the same in every project; the failure mode is identical.

---

## 9 · Failure modes to avoid

| Mistake | Why it's bad | Fix |
|---|---|---|
| Adding a rule without a code snippet | "Wrap errors properly" doesn't tell anyone what to type | Always include exact `fmt.Errorf("op: %w", err)` / exact `ent.…` chain |
| Adding to §X home without §30 catalog row | §30 is the discoverability index — agents grep there first | Always do BOTH edits in one pass |
| Writing back universal-sounding rules that name a customer / DB | Locks one project's reality into doctrine | Names go in overlays (`ubgo-golang-learn`) |
| Hardcoding sync paths instead of discovering them | Doctrine baked to one developer's machine; doesn't port | §0 discovery order — `find` or ask |
| Editing canonical without syncing every installed copy | This session's loaded skill stays out-of-date; sibling agents stay out-of-date | Sync to EVERY discovered installed path; verify with `diff -q` per copy |
| Adding a rule that contradicts ent's actual default behaviour | Future agents follow the rule, ent contradicts at runtime, confusion | Verify against ent docs / source before committing the rule |
| Promoting a transient ent / gqlgen upstream bug to a rule | Bug gets fixed upstream; rule rots | Wait for second occurrence; reference upstream issue if applicable |
| Hedge words ("consider", "should probably", "might want") | Skill body is doctrine, not advice | Imperative present tense always |
| Hard-wrapping prose in markdown | Maintainer's global no-hard-wrap rule; tooling reflows | One physical line per paragraph |
| Adding a new top-level section when an existing one covers it | Skill grows incoherent | Match the §X table in §2; only add a new section if genuinely uncovered |
| Skipping the "verify by" command | Future agents can't audit | Add a grep / `go vet` / `go build` / test command that catches violations |
| Adding a §31 checklist bullet without the corresponding §X rule body | Checklist becomes a wishlist disconnected from doctrine | Always pair: §X rule body + §30 anti-pattern row + §31 check |
| Promoting an ent codegen quirk that only matters in `vendor`-mode builds | Most projects build in workspace mode; rule misleads | Scope the rule explicitly (`when GOFLAGS=-mod=vendor`) or skip |

---

## 10 · Self-improvement of THIS skill

If you (the agent applying this skill) learn something about how to capture Go backend lessons better — write that back here too. This skill is also trained by use.

Same path-discovery rules from §0 apply: don't hardcode where `TRAIN.md` lives; discover via `find … -name "ubgo-golang-train"`, sync to every installed copy at the discovered location, verify with `diff -q`.

If a lesson is universal across BOTH frontend AND backend training (e.g. "always pair §X home + anti-pattern row + checklist bullet"), promote to the sibling `ubgo-frontend-train` too — or extract to a shared meta-skill if the duplication grows past two skills.
