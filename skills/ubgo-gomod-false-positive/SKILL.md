---
name: ubgo-gomod-false-positive
description: >-
  Diagnose + fix the gopls false-positive "X is not in your go.mod file"
  (and "malformed module path: missing dot", "go.work requires go >= X
  (running go Y)") in a Go go.work multi-module workspace, when go build /
  go list pass fine. Covers the five real root causes behind the phantom
  errors — toolchain skew (the sneaky one), missing replace directives,
  dependency version skew, root vendor/, and go-directive mismatch — with a
  deterministic gopls check reproduction and a copy-paste triage. Use when
  the editor (gopls/VS Code Go) red-squiggles imports that ARE in go.mod,
  often on the wrong file, including for obvious local modules.
---

# ubgo-gomod-false-positive

The editor (gopls) red-squiggles an import with **"X is not in your go.mod file"** (quick-fix: `go mod tidy`) — but `go build` and `go list` pass clean, and sometimes the flagged thing is a **local module that obviously IS required** (e.g. `lace`). This is a gopls/workspace tooling false positive, not a code bug. This skill is the diagnostic ladder to nail the *real* cause.

## The fix in one breath

Most of the time the real fix is **environment versions, not go.mod edits**: the system Go must be **≥ the `go` directive in `go.work`**, **gopls must be recent** (≥ v0.22.0 fixed a pruned-graph/local-`replace` false positive that v0.21.1 had), and any deps a **locally-`replace`d module needs must be version-aligned** across the workspace. Then restart the language server. Reach for go.mod surgery (replaces, version bumps) only when Step 0 points there.

## Golden rules (read first)

1. **If `go build` / `go list` / `go mod verify` pass but gopls errors → it's tooling/versions, not your code. Do NOT rewrite imports or code.**
2. **Reproduce deterministically before changing anything:** `gopls check path/to/file.go`. The editor is cached and laggy; `gopls check` shows the exact error gopls's `go/packages` sees. (Caveat: `gopls check` is laxer than the live server about `-mod` — see "What does NOT work.")
3. **The error's FILE is often NOT where the fix is.** The missing entry frequently lives in a *different* module that *depends on* the one in the error. Run diagnostics on **every** module.
4. **Check versions FIRST** (toolchain, gopls, the skewed dep) before editing go.mod — they fix the most cases with the least churn and least risk of making it worse.
5. **Restart the language server** after any change (VS Code: `Cmd+Shift+P` → "Go: Restart Language Server"). gopls caches hard; nothing clears until it re-reads.
6. **`go mod tidy` PRUNES indirect deps; `go work sync` ADDS/reconciles them.** `go work sync` resets each module's *indirect* deps to what the **direct requirer** pins — so a version-alignment fix only sticks if you bump the **direct** requirer (Cause C), not a downstream module. Done right, `go work sync` is a permanent no-op; done wrong, it reverts your hand-bump.

## Step 0 — reproduce + classify

```bash
gopls check path/to/file.go 2>&1 | head -20
```

Match the output to a cause:

| gopls / go output | Cause | Section |
|---|---|---|
| `go.work requires go >= X (running go Y)` → 0 packages load → **everything** errors | toolchain skew | **A** |
| `malformed module path "foo": missing dot in first path element` | missing `replace` | **B** |
| `X is not in your go.mod file`, workspace loads, X is at an older version elsewhere | version skew | **C** |
| `X is not in your go.mod file`, a root `vendor/` exists | root vendor | **D** |
| module `go` directives differ (`1.25.0` / `1.25.9` / `1.26.1`) | go-directive mismatch | **E** |
| `X is not in your go.mod file`, X is **present + correct version**, only on files importing a locally-`replace`d module's transitive deps | old gopls | **F** |
| `X is not in your go.mod file`, X required by **one** module, present in its `go.sum`, builds green, B–F all ruled out (often a pseudo-versioned remote dep, or right after restructuring modules) | workspace graph desync | **G** |

**These stack.** A real case was A + C + F at once: the toolchain skew (A) made the *whole* codebase cascade, masking everything; fixing A revealed a residual on the otel-importing files that was C (version skew) + F (old gopls). Fix top-to-bottom and re-run `gopls check` after each — don't assume one cause.

## A — Toolchain skew (the sneaky one — check this FIRST)

`go.work` says `go 1.26.1`, but the **base** `go` binary is older (e.g. `1.25.5`). The CLI hides this: `GOTOOLCHAIN=auto` silently downloads + runs the newer toolchain, so `go version` *looks* fine. **But gopls runs `go` with `GOTOOLCHAIN=local`** — it uses the OLD base, which **can't load the workspace at all** → 0 packages → **every symbol in every file** shows "not in go.mod." Setting `GOTOOLCHAIN=auto` in gopls's env does **not** help — gopls overrides it.

Detect:
```bash
echo "base:  $(GOTOOLCHAIN=local go version)"   # the REAL binary gopls uses
echo "auto:  $(GOTOOLCHAIN=auto  go version)"   # what the CLI shows
grep '^go ' go.work                              # the required version
```
If `base` < the `go.work` requirement → this is it. Confirm: `gopls check file.go` prints `go.work requires go >= X (running go Y)`.

**Fix (do this — it's the reliable one): upgrade the system go to ≥ `go.work`'s version.** Then gopls's `GOTOOLCHAIN=local` resolves to it natively, no editor config needed.
```bash
cd /tmp && curl -LO https://go.dev/dl/go1.26.1.darwin-arm64.tar.gz \
  && sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.26.1.darwin-arm64.tar.gz \
  && /usr/local/go/bin/go version   # must print go1.26.1
```
Then **rebuild gopls with the new go** (`go install golang.org/x/tools/gopls@latest`) and **fully quit + reopen the editor** (a "restart language server" is not always enough for a toolchain change).

No-sudo stopgap (less reliable — VS Code's Go extension may ignore it; needs a full editor restart, not just an LSP restart): install `golang.org/dl/go1.26.1@latest` + `go1.26.1 download`, then point the extension at it with `"go.goroot"` AND `"go.alternateTools": {"go": "/ABS/HOME/sdk/go1.26.1/bin/go"}` in `.vscode/settings.json`. In practice the system upgrade is what actually stuck.

## B — Missing `replace` directive for a local (dotless) module

Module A imports local module `B` but A's `go.mod` has no `replace B => ../B`. `go.work` masks it for builds, but gopls can't resolve `B` → can't compute the closure → phantom "not in go.mod" for B's transitive deps — **often pinned on the wrong file** (a module that depends on A).

Detect (run on EVERY module — the culprit is rarely the file in the error):
```bash
for d in $(find . -maxdepth 3 -name go.mod -not -path '*/vendor/*'); do
  echo "== $d =="; (cd "$(dirname "$d")" && GOWORK=off go mod tidy 2>&1 | grep -i "malformed module path")
done
```
`malformed module path "B": missing dot in first path element` = `B` needs a replace in that module.

Fix (zero-pseudo-version + replace — a bare `v0.0.0` is itself malformed):
```bash
cd <module-missing-it>
go mod edit -require=B@v0.0.0-00010101000000-000000000000 -replace=B=../../path/to/B
```

## C — Dependency version skew (align the DIRECT requirer, not the erroring file)

The dep IS in go.mod, but at an **inconsistent version** across modules — the module that *directly uses* it (the **direct requirer**) needs a newer version, while others carry it as an older `// indirect` entry pulled in transitively through a local `replace`. Real example: `lace` (which uses otel) required `otel/sdk v1.44.0`, but `apidash`/`core`/`wbh` listed `v1.43.0 // indirect`. gopls reads the mismatch as "not in go.mod."

Detect: `grep -rh '<dep> v' $(find . -name go.mod -not -path '*/vendor/*')` — more than one version = skew.

**The fix is to bump the DIRECT requirer, then let the workspace converge** — NOT to hand-bump the module whose file shows the error:
```bash
cd <module-that-directly-uses-the-dep>   # e.g. lace
go get <dep>@<version>                    # the version it actually needs
cd <workspace-root> && go work sync       # now MVS = that version everywhere; sync converges every module
```
**Why hand-bumping one module fails:** `go work sync` resets each module's *indirect* deps to whatever the direct requirer pins. Bump only a downstream module and sync reverts it. Bump the direct requirer (lace) and sync makes it stick everywhere. Once every go.mod shows the same version, `go work sync` is a permanent no-op (verify: the `grep` above shows ONE version).

## D — Root `vendor/` + go.work

A workspace-root `vendor/` forces gopls into `-mod=vendor`, validating against `vendor/modules.txt` (whose per-module "explicit" annotations may not list a transitive dep) instead of `go.mod`.

Fix — pick one:
- **Drop the local root vendor:** `rm -rf vendor` (prod/CI rebuilds it at deploy; the root vendor is a build artifact, not needed for local editing). This is most repos' intended setup.
- **Keep it consistent:** `go work sync` **then** `go work vendor` (that order — sync writes deps into each go.mod, vendor records them in `modules.txt`). Out of order leaves the vendor stale → phantom errors.

## E — `go` directive mismatch across modules

`go.work` and module `go.mod`s declaring different `go` versions confuses gopls's module graph.

Detect + fix:
```bash
grep -h '^go ' go.work $(find . -name go.mod -not -path '*/vendor/*') | sort | uniq -c   # mixed = bad
# align every module to go.work's version:
for d in $(find . -maxdepth 3 -name go.mod -not -path '*/vendor/*'); do (cd "$(dirname "$d")" && go mod edit -go=1.26.1); done
```

## F — Old gopls (pruned graph + local `replace`)

The deps ARE in go.mod (correct version, `// indirect`), the toolchain is fine, the workspace loads, `go build`/`go list -m <dep>`/`go mod verify` all pass — and gopls STILL flags transitive deps of a **locally-`replace`d** module (e.g. `lace`'s otel stack) as "not in go.mod," only on the files that import them. This was a **gopls v0.21.1** bug with Go's pruned module graph + local replaces.

Fix: **upgrade gopls** (build it with the new go so it matches the toolchain):
```bash
go install golang.org/x/tools/gopls@latest && gopls version   # >= v0.22.0
```
v0.22.0 resolves the case v0.21.1 false-flagged. Combined with Cause C (align the replaced module's deps), this clears it with **no go.mod hacks**.

## G — Workspace graph desync (build green, single-module dep, none of A–F fit)

A remote dependency — often pinned to a **pseudo-version**, or surfaced right after **restructuring the workspace** (moving module dirs into `modules/`, adding/removing a module) — is correctly required in its module's `go.mod`, present in that module's `go.sum`, and `go build` / `go list -deps` resolve it fine, yet gopls phantom-flags it with "X is not in your go.mod file." What's stale is gopls's *workspace* module-graph view, which the CLI (reading the module's own `go.sum` + vendor) never depends on. This is **not** Cause C (only one module requires it, so there is no version to skew) and **not** Cause D (the dep is present and marked `## explicit` in `vendor/modules.txt`, and **removing `vendor/` does not clear it** — that test is how you rule D out here).

Detect — confirm the CLI disagrees with gopls, then confirm it's a single-module dep (which is what rules out C):

```bash
gopls check path/to/file.go 2>&1 | grep 'not in your go.mod'                 # gopls flags it
(cd module-that-imports-it && go list -deps ./... 2>&1 | grep '<dep>')       # CLI resolves it → desync
grep -rh '<dep> v' $(find . -name go.mod -not -path '*/vendor/*') | sort -u  # ONE line = single requirer, not C
```

Fix — reconcile the workspace graph, re-vendor, restart gopls, **in this order**:

```bash
go work sync          # reconciles the workspace module graph (this is the actual fix)
go work vendor        # re-record it in vendor/modules.txt
pkill -f gopls        # or editor "Go: Restart Language Server"
gopls check path/to/file.go   # verify: 0 findings
```

Two caveats that cost real debugging time here:

- **`go work sync` is safe in this case, despite the Cause-C warning elsewhere in this skill.** Sync only moves each module's *indirect* deps to whatever the **direct** requirer pins; a single-module **direct** dependency has no competing requirer, so its pin does not move. Verify after: the dep's version line in `go.mod` is byte-for-byte unchanged. (The "NOT `go work sync`" caution in the fast triage is specific to Cause C, where you've hand-bumped a downstream module — it does not apply to G.)
- **Do not gate the diagnosis on `go.work.sum`.** In the observed case `go work sync` flipped gopls clean while the dep's hash was *still absent* from `go.work.sum` — so "missing `go.work.sum` entry" is a red herring, not the mechanism. The exact internal state `go work sync` reconciles is not fully pinned down; treat the sequence above as the empirical fix, not a theory, and trust `gopls check` returning 0 over any single sum-file grep.

## What does NOT work (dead ends — don't repeat them)

- **`GOFLAGS=-mod=mod`** — rejected by the live language server in workspace mode: `go: -mod may only be set to readonly or vendor when in workspace mode`. It only "succeeds" under the `gopls check` CLI, which is misleading. In workspace mode all three (`readonly` / `vendor` / `mod`) leave the Cause C/F false positives — the fix is versions, not `-mod`.
- **Blank-import `deps.go` files** (force the deps "direct") — works, but it's whack-a-mole across every affected module and pure noise. Prefer fixing versions (C + F).
- **`GOWORK=off` + `-mod=mod`** — clears the false positives but demands a complete `replace` for every local module in every go.mod and drops the unified workspace view. Heavy; last resort.
- **Removing the root `vendor/`** — a red herring for the Cause C/F false positives (doesn't clear them). Only relevant for actual Cause D.

## Fast triage (copy-paste, top to bottom)

```bash
# 0. reproduce + classify
gopls check path/to/file.go 2>&1 | head
# A. toolchain skew — base (what gopls uses) vs required
echo "base: $(GOTOOLCHAIN=local go version)"; grep '^go ' go.work
# F. gopls version (>= v0.22.0)
gopls version | head -1
# C. dep version skew — same dep, different versions across modules
grep -h 'opentelemetry.io/otel/sdk ' $(find . -name go.mod -not -path '*/vendor/*') | sort | uniq -c
# B. missing replaces — per module
for d in $(find . -maxdepth 3 -name go.mod -not -path '*/vendor/*'); do (cd "$(dirname "$d")" && GOWORK=off go mod tidy 2>&1 | grep -i 'malformed module path' | sed "s#^#$d: #"); done
# E. go-directive skew across modules
grep -h '^go ' go.work $(find . -name go.mod -not -path '*/vendor/*') | sort | uniq -c
# Apply the fix the diagnosis points at (usually: upgrade go + gopls, align the skewed dep),
# then `go work vendor` (NOT `go work sync` after a C fix — but for Cause G it IS the fix; see G), then restart gopls.
```

## Why this is so confusing (the meta-lesson)

The causes **stack**, and version problems hide behind code-shaped errors. A toolchain skew (A) makes the *whole* workspace fail to load, masquerading as a flood of "not in go.mod"; fix A and a residual (C + F) surfaces on a few files. Throughout, `go build`/`go test`/`go mod verify` stay green — proof it was never your code. So: **check versions before editing go.mod** (toolchain ≥ go.work, gopls ≥ v0.22.0, the replaced module's deps aligned at the direct requirer), trust `gopls check` over the editor, and run diagnostics on **every** module.

## Worked incident — the real 2026-06-23 case (and the dead ends, so you skip them)

Symptom: a `go.work` monorepo (~18 modules, `lace` shared lib pulling the OTel + zap + lumberjack stack, wired everywhere via `replace lace => ../lace`). The editor flooded `apidash/main.go` and others with `… is not in your go.mod file`. `go build ./...` was green.

What I tried, in order — **the ✅ are the fix, the ❌ were wasted moves; learn the order from this:**

1. ❌ Chased it as missing go.mod entries — added `replace addons/filemgr` to `apps/sync`, `addons/wfrun` to `shopify` (these WERE genuinely missing — Cause B — and worth fixing, but they were not THE bug). Squiggles stayed.
2. ❌ `go work sync` + `go work vendor`, re-vendored, aligned all module `go` directives to 1.26.1 (Cause E hygiene). Still there.
3. ❌ Fought the root `vendor/` — removed it, tried `GOFLAGS=-mod=vendor`. No change (Cause D was a red herring here).
4. ✅ **Ran `gopls check modules/apidash/main.go` — the turning point.** It printed `go.work requires go >= 1.26.1 (running go 1.25.5)`. That one line = Cause A. *Should have been step 1.*
5. ✅ Confirmed with `GOTOOLCHAIN=local go version` → `go1.25.5` (the base), while plain `go version` → `1.26.1` (auto-downloaded). gopls forces `GOTOOLCHAIN=local`, so it used 1.25.5 and couldn't load the workspace → the whole cascade.
6. ❌ Editor stopgap: installed `golang.org/dl/go1.26.1`, set `go.goroot` then `go.alternateTools`. The live VS Code server didn't reliably pick it up.
7. ✅ **Upgraded the SYSTEM go to 1.26.1** (`/usr/local/go`). Workspace loaded; the codebase-wide cascade vanished. Residual: ~14 lines, only on files importing `lace`'s otel stack.
8. ❌ For the residual: `go get otel@1.44.0` in `apidash` only → cleared briefly, then `go work sync` reverted it (didn't yet understand Cause C's direct-requirer rule). Tried blank-import `deps.go` (worked but whack-a-mole). Tried `GOFLAGS=-mod=mod` — the live server **rejected** it (`-mod may only be set to readonly or vendor when in workspace mode`); only the `gopls check` CLI tolerated it (misleading).
9. ✅ **Upgraded gopls 0.21.1 → 0.22.0** (Cause F) and **aligned otel at the direct requirer `lace` to v1.44.0**, letting `go work sync` converge every module to v1.44.0 (Cause C done right). Residual → 0.
10. ✅ Verified: `gopls check` across 12 files spanning every module = 0; `go work sync` now a confirmed no-op; build + tests green.

Total: a long session that a **version-first triage** (Step 0 `gopls check` → check toolchain, gopls, dep-skew) would have collapsed to ~10 minutes. That triage order is the whole point of this skill.
