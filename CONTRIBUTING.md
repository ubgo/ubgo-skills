# Contributing to ubgo-skills

This repo is a personal library that other developers can fork, install, and contribute back to. Skills here capture rules + patterns that have been earned in real production codebases — the bar is "we hit X, here's the fix", not "I read about Y in a blog."

## Philosophy

> A skill is doctrine, not advice. Every line of a skill file should be something the maintainer would defend in code review.

That means:

- Every rule cites a **failure mode** (the bug, drift, or production incident it prevents).
- Every pattern includes a **verbatim shape** (exact classNames, exact function signatures, exact CLI flags) — not paraphrase.
- Every section earns its place: if the rule's failure mode is theoretical or stylistic, it doesn't belong.
- Drive-by preference edits (vibes without why) get rejected.

## How to contribute

### 1. Sharpen an existing rule

If you hit a real failure mode that an existing rule almost-but-not-quite covers, open a PR that extends the relevant rule with the new case. Format:

```markdown
### <existing rule heading>

… existing rule body …

**Edge case (added <date> by @<your-handle>):** <what happened, in one paragraph>. The fix: <one-paragraph fix that maps the existing rule to this scenario>.

```<language>
// canonical shape for this edge case
```
```

Cite the existing skill's section number in the PR description (e.g. "extends §11 ServerDataTable rule with new pagination-trap edge case").

### 2. Add a new anti-pattern

Anti-pattern catalogs in skills (`golang.md` §30, `frontend.md` §26) are the single index of "things we banned." If you're adding a new rule with a hard failure mode, also add a one-line row to the catalog. Format:

```markdown
| <anti-pattern in one phrase> | <why banned in one sentence> | <what to do instead, with §X cross-ref> |
```

The §X cross-ref is non-negotiable — every catalog row points to its home section.

### 3. Add a new skill

Open an issue FIRST to discuss whether the topic earns its own skill or extends an existing one. Bar:

- The topic generalizes beyond one repo (it's universal, not project-specific).
- It doesn't fit cleanly inside any existing skill's scope.
- It will have a non-trivial body (multiple sections, anti-patterns, verbatim shapes) — not just one rule.
- Naming follows `ubgo-<topic>` (and `ubgo-<topic>-train` / `ubgo-<topic>-learn` siblings if applicable).

When the issue is approved:

1. Create `skills/ubgo-<topic>/` with `SKILL.md` (YAML frontmatter: `name`, `description`) + a body file (`<topic>.md`).
2. Update the README skills table — keep the description tight; the body is the long form.
3. If the topic should also be trainable (new rules get captured back during real use), add `ubgo-<topic>-train` with a `SKILL.md` + `TRAIN.md`. Use `ubgo-golang-train` as the canonical template.
4. If projects need overlays for this topic, add `ubgo-<topic>-learn` with a `SKILL.md` describing the bootstrap recipe + multi-agent target paths. Use `ubgo-golang-learn` as the canonical template.

### 4. Promote a project-specific lesson to universal

If you have a learning in a project overlay (`golang-project.md` / `frontend-project.md`) that's actually universal (you'd want it in EVERY repo of that stack), promote it via the `train` skill — load `ubgo-<topic>-train` and apply its decision tree + write-back ritual. Then PR the canonical change here.

Counter-test: if your "universal" rule references a customer name, DB name, tenant ID, named constant specific to one app, file path inside one repo, or a brand color — it's NOT universal. Keep it in the overlay.

### 5. Fix a typo / small wording

Direct PR. No issue needed. Single-purpose commit (don't bundle a typo fix with a rule sharpening).

## Style rules

### No hard-wrapped markdown

Every prose paragraph runs on a single physical line. Tables, fenced code blocks, and YAML frontmatter are the only line-break exceptions. The maintainer's other repos enforce this too — assume CI will flag it.

```markdown
<!-- WRONG: hard-wrapped at ~80 cols -->
This is a paragraph that explains a rule. The text was wrapped manually
at column 80 because the contributor's editor inserted line breaks
automatically.

<!-- RIGHT: one physical line per paragraph -->
This is a paragraph that explains a rule. The text runs on one line and lets the markdown renderer wrap it visually; the file diff stays clean across rule edits.
```

### Voice

- **Imperative, present tense.** "Use X" not "you should use X" not "it is recommended to use X".
- **Concrete > abstract.** Show the exact `className`, the exact `ent.…` chain, the exact `fmt.Errorf("op: %w", err)` — not "validate inputs properly".
- **No hedging.** "Default to X" not "consider X". Skill content is doctrine; chat replies can hedge.
- **Cite the failure mode.** Every rule statement is `<rule> + because <bug it prevents>`.
- **No customer / repo names in canonical files.** Universal means universal — project-specific names live in overlays.
- **No machine-specific paths.** Discovery > hardcode. Skills locate canonical + installed copies at runtime; never bake an absolute path into a rule.

### Formatting

- Section headings are numbered (`## 0`, `## 1`, …) so cross-references work (`see §11 for the rule`).
- Code fences carry the language tag (`go`, `tsx`, `bash`, `sql`, …).
- Tables use markdown pipe syntax; align with the existing convention in the file.
- Lucide-only for icon examples in frontend skills. No mixing icon libraries.

### Section targeting

When extending an existing skill, match the lesson to the existing section table at the top of the skill's `TRAIN.md` (e.g. `ubgo-golang-train` §2 lists which section each lesson type lands in). Don't append a new top-level section unless the existing ones genuinely don't cover the topic.

## Two-occurrence rule (for verbatim patterns)

For verbatim UI patterns or verbatim code shapes — generally don't promote to canonical until you've written the same shape **twice** across different files / different sessions. Once may be coincidence; twice is a pattern.

**Exception:** hard rules (`NEVER X`) can be promoted on first occurrence if the failure mode is severe (data loss, security, broken DB migration, accessibility regression).

## PR checklist

Before opening a PR:

- [ ] One concern per PR (don't bundle unrelated changes)
- [ ] Every new rule cites its failure mode
- [ ] Every new rule includes a verbatim code shape
- [ ] If you added a hard rule, you also added an anti-pattern catalog row (§30 in golang.md / §26 in frontend.md) cross-referencing its home section
- [ ] If you added a rule with a verifiable check, you added a pre-PR checklist bullet (§31 in golang.md / §27 in frontend.md)
- [ ] No hard-wrapped markdown
- [ ] No customer / repo names in canonical files (they belong in overlays)
- [ ] No hardcoded machine-specific paths
- [ ] README skills table is up to date if you added or renamed a skill
- [ ] PR description states which existing rule the change sharpens (or why a new skill is needed)
- [ ] PR description includes the real-world failure mode you observed

## When NOT to contribute

- The rule is project-specific (file path, customer, named constant, brand color) — use the project overlay flow via `ubgo-<topic>-learn`, not this repo.
- The rule duplicates content already in another skill — link, don't restate. If the duplication is structural (the same meta-rule appears across multiple skills), extract a shared meta-skill in a separate PR.
- The rule is a personal preference without a failure mode (tabs vs spaces, named-export vs default-export when both work) — keep it in your own dotfiles.
- The "fix" is a workaround for a transient upstream bug that's likely to get fixed. Wait for the second occurrence; reference the upstream issue if you do promote.

## Reorgs + breaking changes

Open an issue first for:

- Renaming a skill
- Splitting one skill into multiple
- Removing a skill
- Changing the overlay file naming convention
- Changing the `ubgo-` prefix convention
- Adding a new skill family beyond `rules / train / learn`

These touch every consumer of the skill — discuss before merging.

## Versioning

Skills here aren't semver-versioned today. Breaking changes go through the reorg flow above + get a heads-up in the PR. If we ever ship a version pin, it'll be a single `VERSION` file at repo root + per-skill `version` fields in `SKILL.md` frontmatter.

## License

All contributions are licensed under the same [MIT](LICENSE) as the project. By opening a PR you confirm you have the right to contribute the change and license it under MIT.

## Questions

Open an issue. The maintainer reads them.
