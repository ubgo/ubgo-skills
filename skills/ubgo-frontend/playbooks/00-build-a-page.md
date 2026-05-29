# Playbook 00 — Build a nice list/CRUD page from scratch

The canonical recipe. Run top-to-bottom. Every step references the verbatim primitive in `examples/`. When the user says "build a settings page for X" / "I need a CRUD page for Y", this is the path.

Outcome: a page that ships with PageHeader (icon + title + subtitle + primary CTA), a dense table with hover rows + per-row ellipsis menu, a 3-zone create dialog, a reveal/confirm dialog, empty + loading states — and every interactive element shows a hand cursor on hover. Polaris-grade out of the box.

## 0 · Decide density flavor

Look at the project's `src/components/ui/button.tsx`. Two flavors (§29.1.5):

- **Default flavor (h-8 chrome):** ubgo's baseline; matches dense admin UIs (Notion-like).
- **Polaris-dense (h-7 chrome):** matches Shopify Polaris / Linear / Vercel. Use this when the user has ever said "sleek", "compact", "Polaris-grade", "Linear-tight".

Commit to ONE flavor in the project's primitives (Button / Input / Dialog / Dropdown / Sidebar) before building pages. Mixing is the #1 reason a page looks broken.

## 1 · Make sure the primitives are right

Before touching the route, verify these 5 files in the project match the flavor you picked. Copy from `examples/` if any is wrong:

| File | Reference | Why it matters |
|---|---|---|
| `src/components/ui/button.tsx` | `examples/button.tsx` | Bakes `cursor-pointer`, `active:translate-y-px`, no shadow, density. |
| `src/components/ui/input.tsx` | `examples/input.tsx` | Flat 1px border, clean focus ring, no `shadow-sm`. |
| `src/components/ui/native-select.tsx` | `examples/native-select.tsx` | Wrap raw `<select>` with `appearance-none` + lucide chevron. Don't skip — raw `<select>` breaks row alignment. |
| `src/components/ui/dialog.tsx` | `examples/dialog-3-zone.tsx` | 3-zone (Header / Body / Footer) with `border-b` / `border-t bg-muted/40`. Close X has `cursor-pointer`. |
| `src/components/admin-shell.tsx` (PageHeader) | `examples/page-header.tsx` | 5-slot shape. Owned by leaf, NOT auto-injected by layout. |

**Rule:** if you find any primitive off-spec, fix the primitive in one pass, then build the page. Don't patch around it per page.

## 2 · Layout owns the shell + gutter — that's it

```tsx
// src/routes/settings/route.tsx
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { SettingsShell } from "@/components/settings-shell"

export const Route = createFileRoute("/settings")({ component: Layout })

function Layout() {
  return (
    <SettingsShell>
      <div className="px-5 py-4 max-w-3xl">
        <Outlet />
      </div>
    </SettingsShell>
  )
}
```

Anti-pattern: a `TITLES: Record<RoutePath, string>` map in the layout that injects a `<PageHeader title={…}>`. Brittle, duplicates routing knowledge, blocks per-page primary CTAs. PageHeader is OWNED BY THE LEAF (§12).

## 3 · The leaf page — five sections in this order

```tsx
// src/routes/settings/api-keys.tsx
function ApiKeysPage() {
  // 3.1 — state (one useState per concern; no useReducer for <5 fields)
  const [keys, setKeys] = useState<AuthApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  // 3.2 — reload (the One function the page rebuilds from)
  async function reload() {
    setLoading(true)
    try { setKeys(await listMyApiKeys()) } finally { setLoading(false) }
  }
  useEffect(() => { void reload() }, [])

  // 3.3 — handlers (one per CTA / row action)
  async function onCreate(name: string) { … await reload() }
  async function onRevoke(id: string) {
    if (!confirm("Revoke this API key? Existing callers will start receiving 401.")) return
    await revokeApiKey(id); await reload()
  }

  // 3.4 — render
  return (
    <div>
      <PageHeader
        icon={<KeyRound />}
        title="API keys"
        subtitle="Machine credentials for plugins, scripts, and webhooks"
        primaryAction={
          <Button onClick={() => setCreateOpen(true)} className="gap-1">
            <Plus className="size-3" />
            New key
          </Button>
        }
      />

      {/* Sub-toolbar — counter, filters, search (optional) */}
      <div className="mb-2 text-[11px] text-muted-foreground tabular-nums">
        {loading ? "…" : `${keys.length} keys`}
      </div>

      {/* Table — three branches: loading / empty / data */}
      {loading ? <LoadingState /> : keys.length === 0 ? <EmptyState onCreate={() => setCreateOpen(true)} /> : <Table rows={keys} onRevoke={onRevoke} />}

      {/* Dialogs at the bottom of the component — flat, not nested */}
      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={onCreate} />
    </div>
  )
}
```

Five idioms, every page:

1. **`reload()` is the contract** — every mutation calls `await reload()` last. No optimistic updates until v2.
2. **Three table branches in this order** — loading first, empty second, data third. Don't nest; flat `?:` chain reads better.
3. **Dialogs live at the bottom of the component**, not inside the table. Flat hierarchy.
4. **Sub-toolbar is one line** — counter + (optional) search + (optional) filter chip row. NEVER a duplicate `<h1>` here — PageHeader owns the title.
5. **PageHeader is the top of the return.** Nothing renders above it inside the leaf.

## 4 · The table — verbatim shape

```tsx
<div className="rounded-md border border-border bg-background overflow-hidden">
  <table className="w-full text-[13px]">
    <thead className="bg-muted/50 text-[12px] text-foreground">
      <tr className="border-b border-border">
        <th className="text-left font-semibold px-3 py-2">Name</th>
        <th className="text-left font-semibold px-3 py-2 w-[160px]">Prefix</th>
        <th className="text-left font-semibold px-3 py-2 w-[100px]">Scope</th>
        <th className="text-left font-semibold px-3 py-2 w-[130px]">Last used</th>
        <th className="text-left font-semibold px-3 py-2 w-[90px]">Status</th>
        <th className="px-3 py-2 w-[40px]" />
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-muted/60">
          <td className="px-3 py-2 font-medium text-foreground truncate max-w-[260px]">{r.name}</td>
          <td className="px-3 py-2 font-mono text-[12px] text-foreground/70">ak_{r.prefix}_…</td>
          <td className="px-3 py-2 text-foreground/70">{r.scope.toLowerCase()}</td>
          <td className="px-3 py-2 text-foreground/70 tabular-nums">{r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleDateString() : "—"}</td>
          <td className="px-3 py-2"><StatusDot active={!r.revokedAt} /></td>
          <td className="px-1 py-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="cursor-pointer rounded p-1 hover:bg-muted text-foreground/70 hover:text-foreground">
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => onRevoke(r.id)}>Revoke key</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Key calls:

- **Header is `text-[12px] font-semibold text-foreground`** — NOT uppercase tracking-wider tiny gray (legibility flavor — §29.7).
- **Body primary column** (the identifying name): `font-medium text-foreground`. Secondary columns: `text-foreground/70`. Never `text-muted-foreground` on rows the user has to scan.
- **Row hover:** `hover:bg-muted/60`. The row IS the affordance; no need to dim the rest.
- **Ellipsis trigger has `cursor-pointer`** — every interactive `<div>` / `<button>` does.
- **Action column** is `w-[40px]` with `px-1 py-1`, last column. Don't put it first; don't make it wider than 40px.
- **Numbers use `tabular-nums`** so they align across rows.

## 5 · The create dialog — 3-zone (Polaris)

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <form onSubmit={onSubmit} className="contents">
      <DialogHeader>
        <DialogTitle>Create API key</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="space-y-1.5">
          <Label htmlFor="name">Label</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Feed export script" autoFocus autoComplete="off" spellCheck={false} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create key"}</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

Three zones, three separator lines, three padding regions — see `examples/dialog-3-zone.tsx`.

`form` with `className="contents"` lets it span the three zones without breaking flex / grid layout.

## 6 · Empty + loading states

```tsx
// Loading — thin one-liner, not a spinner
<div className="rounded-md border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">Loading…</div>

// Empty — dashed border, centered, inviting CTA inline
<div className="rounded-md border border-dashed border-border bg-background py-8 text-[12px] text-muted-foreground text-center">
  No API keys yet. Click <span className="font-medium text-foreground">New key</span> to mint one.
</div>
```

Rule: empty state mentions the primary action by name. "No items yet" alone is dead-end UX.

## 7 · Done-criteria checklist

Before declaring the page done, run this:

- [ ] PageHeader has icon + title + subtitle + primaryAction
- [ ] Layout did NOT auto-inject the header (the leaf owns it)
- [ ] Table header `text-[12px] font-semibold text-foreground` (legibility), NOT uppercase tiny gray
- [ ] Body cells use `text-foreground` or `/70`, never `text-muted-foreground`
- [ ] Row hover background present
- [ ] Every interactive element shows hand cursor on hover (Button base, dialog X, dropdown trigger, ellipsis button)
- [ ] Dialog uses 3-zone pattern with `border-b` / `border-t bg-muted/40`
- [ ] Empty state names the primary CTA
- [ ] Loading state is a one-line muted strip, not a spinner
- [ ] Sub-toolbar counter is `text-[11px] tabular-nums text-muted-foreground`
- [ ] Numbers in tables use `tabular-nums`
- [ ] No `shadow-sm` on Input or Button
- [ ] No opacity-dimmed borders (`/40`, `/60`, `/80`) anywhere

If any line above is off, fix at the primitive layer, not the page. Then move on.
