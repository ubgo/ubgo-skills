# Playbook 01 — Density pass (flipping a project to Polaris-grade)

When the user says any of:

- "make it more compact / sleek"
- "Polaris-grade", "Linear-tight", "Vercel-style"
- "this looks too big / too fatty / too washy / hardly visible"
- "the chrome feels heavy / 2010 admin"
- "iterate on UI" without further detail

…run THIS sequence in one pass. Don't iterate page-by-page — the user will keep flagging the next page until the whole project is converted. The fix is at the primitive layer, applied once.

The density mapping is in `frontend.md` §29.1.5. This playbook is the operational sequence.

## 0 · Take a baseline screenshot

Before any change. Saves you a round-trip when the user asks "what changed".

## 1 · Flip the 7 primitives (in this order)

| # | File | What to change |
|---|---|---|
| 1 | `src/components/ui/button.tsx` | Default size = `h-7 px-3 text-[12px] font-medium rounded-lg`. Bake `cursor-pointer` + `active:translate-y-px` + `disabled:cursor-not-allowed` at the cva base. No shadow on any variant. |
| 2 | `src/components/ui/input.tsx` | `h-7 px-2.5 text-[12px] rounded-md`, flat 1px `border-input`. Kill `shadow-sm`. Kill any `border-t-foreground/30` or inset-shadow tricks. |
| 3 | `src/components/ui/native-select.tsx` | Create if missing — see `examples/native-select.tsx`. Replace every raw `<select>` usage. |
| 4 | `src/components/ui/dialog.tsx` | 3-zone pattern. DialogTitle `text-[15px] font-semibold`. DialogHeader `border-b`. DialogFooter `border-t bg-muted/40`. Add `DialogBody` export. Close X gets `cursor-pointer`. Max-width default `400px` (raise per-dialog when needed). |
| 5 | `src/components/ui/dropdown-menu.tsx` | Items: `py-1 text-[12px]`, icons `size-3.5`. Min-width `7rem`. Outer padding `p-0.5`. Label: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`. |
| 6 | `src/components/admin-shell.tsx` (Sidebar) | nav `p-2`. Items `px-2 py-1.5 rounded-md text-[13px]`. Icons `size-[16px]`. Inactive item: `text-foreground/80` (NOT `text-muted-foreground`). Active item: `bg-primary/10 text-primary` + NO shadow. Section labels: `text-[11px] font-semibold text-foreground/80` mixed-case (NOT uppercase tracking-wider). |
| 7 | `src/components/admin-shell.tsx` (PageHeader) | Replace with the 5-slot shape — see `examples/page-header.tsx`. Remove any auto-injected route-TITLES map from the layout. |

## 2 · Sweep washy colors (one-shot regex)

```bash
# borders
rg -l "border-(border|input)/(20|30|40|50|60|70|80)" src/ | xargs sed -i '' 's/border-border\/[0-9]\+/border-border/g; s/border-input\/[0-9]\+/border-input/g'

# muted-foreground in chrome
rg -l "text-muted-foreground/(60|70|80)" src/ | xargs sed -i '' 's/text-muted-foreground\/[0-9]\+/text-muted-foreground/g'

# muted backgrounds — bump up
rg -l "bg-muted/(20|30)" src/ | xargs sed -i '' 's/bg-muted\/20/bg-muted\/50/g; s/bg-muted\/30/bg-muted\/60/g'
```

Spot-check after the sweep — these are blunt; you may need to revert specific files where opacity was intentional (subtle dividers, watermark text).

## 3 · Tables — switch to legibility flavor

Every list page. The editorial flavor (uppercase tiny gray) reads as washy on data screens — switch to:

```
thead: bg-muted/50 text-[12px] text-foreground
       <th>: text-left font-semibold px-3 py-2
tbody: divide-y divide-border
       primary cell: font-medium text-foreground
       secondary cell: text-foreground/70
       numeric cell: text-foreground/70 tabular-nums
row hover: hover:bg-muted/60
```

§29.7 has the full rationale.

## 4 · PageHeader rollout

Every leaf page gets `<PageHeader icon={…} title={…} subtitle={…} primaryAction={…} />` at the top of its return. Layout no longer renders a header.

```tsx
<PageHeader
  icon={<KeyRound />}
  title="API keys"
  subtitle="Machine credentials for plugins, scripts, and webhooks"
  primaryAction={<Button>New key</Button>}
/>
```

Icons: lucide, rendered at `size-[18px]` (handled by the PageHeader CSS).

## 5 · Cursor-pointer audit

Grep every interactive element. If it clicks, it shows the pointer:

```bash
rg "DropdownMenuTrigger|onClick=\{" src/ | rg -v "cursor-pointer"
```

Anything that surfaces needs `cursor-pointer` added — either at the primitive base (preferred) or inline on the className. Half-hand-half-Ibeam chrome reads as broken even when behavior is correct.

## 6 · Verify by DevTools

Open the running app. Tab through every page. Check:

- Chrome buttons render at 28px (h-7).
- Inputs render at 28px (h-7).
- Hover on any clickable element shows hand cursor.
- Sidebar inactive items are legible (not gray-on-gray).
- Table headers are legible (not tiny uppercase gray).
- No element renders a box-shadow except popovers / dropdown menus / dialog backdrops.

## 7 · Tell the user what landed

One paragraph. Name the primitives you edited + the sweep counts. Example:

> Flipped to Polaris-dense in one pass: Button/Input/Dialog/Dropdown/Sidebar/PageHeader primitives rewritten, 47 opacity-dimmed border classes upgraded to solid, 12 raw `<select>` replaced with NativeSelect, every page's table switched to legibility-flavor headers. Cursor-pointer baked at primitive bases — 0 leaks.

Then stop. Don't keep iterating without new feedback.

## Anti-patterns of this playbook itself

- **Don't patch one page in isolation** — the user will surface the next page next session. Convert all primitives in one pass.
- **Don't ship mixed density** — h-7 button next to h-8 input looks broken. Whole project to one flavor.
- **Don't add `cursor-pointer` per call-site** — bake at the cva base on Button + on every interactive primitive's className. Per-site is unmaintainable.
- **Don't keep `shadow-sm` "for tasteful depth"** — Polaris is explicitly flat. Shadows belong on popovers / dialogs only.
- **Don't preserve uppercase-tiny-gray section labels** because they look editorial — on busy chrome they read as broken / disabled. Mixed-case semibold wins.
