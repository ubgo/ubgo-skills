# Reference UI surfaces — sync_go (live shots)

Visual reference for every canonical Polaris-grade surface, captured from the running sync_go admin (`https://sync.localhost/*`). Each entry has:

- The route that produces it.
- A live PNG in `screenshots/` (committed alongside this file).
- An ASCII mockup of the layout.
- The 6–8 visual rules that surface enforces.
- Which `examples/` primitives wire it up.

> All shots taken at 1457×812 viewport via `modern-screenshot` (oklch-aware). To re-capture: navigate to the route in Chrome at `https://sync.localhost`, paste this in DevTools console (oklch-safe), the PNG downloads to `~/Downloads/`:
>
> ```js
> (async () => {
>   const m = await import('https://esm.sh/modern-screenshot@4');
>   const d = await m.domToPng(document.documentElement, { backgroundColor: '#ffffff' });
>   const a = document.createElement('a'); a.href = d; a.download = '<page>.png'; a.click();
> })()
> ```

## Index

| Page | PNG | Pattern it canonicalizes |
|---|---|---|
| `/settings/api-keys` | [`screenshots/api-keys.png`](./screenshots/api-keys.png) | List + table + per-row ellipsis menu |
| `/settings` (Profile) | [`screenshots/settings-profile.png`](./screenshots/settings-profile.png) | Read-only detail panel |
| `/settings/workspaces` | [`screenshots/settings-workspaces.png`](./screenshots/settings-workspaces.png) | Flat list with per-row inline actions |
| `/t/$tenantId/settings/members` | [`screenshots/tenant-members.png`](./screenshots/tenant-members.png) | Empty state |
| `/sa` (Super admin) | [`screenshots/sa-admin.png`](./screenshots/sa-admin.png) | Filter input + impersonate list |
| Dialog open | [`screenshots/dialog-create.png`](./screenshots/dialog-create.png) | 3-zone create dialog (Header / Body / Footer with separators) |

---

## 1 · `/settings/api-keys` — list page with data

The canonical list/CRUD page. Cite this when asking "what should a new resource page look like?".

```
┌─ Sidebar (220px) ─┐┌─ Content (gutter px-5 py-4 max-w-3xl) ────────────┐
│ ← Back to PIM    │ │ 🗝  API keys                          [+ New key] │
│                  │ │    Machine credentials for…                       │
│ ACCOUNT          │ ├───────────────────────────────────────────────────┤  border-b border-border pb-3 mb-4
│ • Profile        │ │ 2 keys                                             │  text-[11px] tabular-nums text-muted-foreground
│ • API keys (■)   │ │ ┌─────────────────────────────────────────────┐   │
│ • My tenants     │ │ │ Name  │ Prefix       │ Scope │ Last │ Status │…│ │  thead: bg-muted/50 text-[12px] font-semibold
│                  │ │ ├───────┼──────────────┼───────┼──────┼────────┼─┤ │
│ TENANT · Solver… │ │ │ Untitled key │ ak_eo… │ acct │ —    │ ●Active│⋯│ │  row hover:bg-muted/60
│ • General        │ │ │ test         │ ak_3b… │ acct │ —    │ ●Active│⋯│ │
│ • Members        │ │ └─────────────────────────────────────────────┘   │
│                  │ │                                                    │
│ SYSTEM           │ │                                                    │
│ • Super admin    │ │                                                    │
│                  │ │                                                    │
│ AK Aman Kothari  │ │                                                    │
└──────────────────┘└────────────────────────────────────────────────────┘
```

**Rules this surface enforces:**

- PageHeader has 4 of 5 slots populated: `icon` (KeyRound), `title`, `subtitle`, `primaryAction`. No `secondaryActions`, no `right`.
- Sub-toolbar is ONE line — just the counter (`2 keys` / `…` while loading). Search + filter chips can join the same row when needed.
- Table header is `text-[12px] text-foreground font-semibold` on `bg-muted/50` — the LEGIBILITY flavor, NOT uppercase tiny gray.
- Body cell #1 (name): `font-medium text-foreground`. Body cells #2–4 (prefix/scope/lastUsed): `text-foreground/70`. Body cell #5 (status): `StatusBadge` with colored dot.
- Row hover background: `hover:bg-muted/60`. Every row is hoverable.
- Action column is last, `w-[40px]` with `MoreHorizontal` ellipsis. Trigger has `cursor-pointer`.
- Sidebar section labels (`ACCOUNT`, `TENANT · Solverhood`, `SYSTEM`) are **mixed-case font-semibold text-foreground/80** — NOT uppercase tracking-wider tiny gray.
- Inactive sidebar items are `text-foreground/80` (legible). Active is `bg-primary/10 text-primary font-medium` (no shadow).
- Sidebar footer: user avatar (initials in primary-tinted square) + name + email + toggle indicator.

**Wired by:** `admin-shell.tsx` (sidebar + PageHeader + StatusBadge) · `data-table.tsx` · `dropdown-menu.tsx`.

---

## 2 · `/settings` (Profile) — read-only detail panel

The canonical detail/info panel. Cite when asking "how do I show static record info?".

```
🧑 Profile
   Your account details and sign-in
─────────────────────────────────────────────────────  border-b
┌────────────────────────────────────────────────────┐
│ Email          amank@solverhood.com                │  divide-y rows, px-3 py-1.5
│ Name           Aman Kothari                        │  label text-muted-foreground, value text-foreground
│ Email verified No                                  │
│ User ID        usr_w1r4w6cacyipxt92d  (font-mono)  │
│ Role           Super-admin                         │
└────────────────────────────────────────────────────┘

Password
We'll email you a one-time link to set a new password.
[ Email me a reset link ]

Sign out
[ Sign out ]
```

**Rules:**

- PageHeader icon = UserCircle (lucide). Title, subtitle. No actions.
- Read-only data lives in a `divide-y` `border bg-background rounded-md` panel. Label column is `w-32 text-muted-foreground`; value column is `text-foreground` (or `font-mono text-[11px]` for IDs).
- Section headings ABOVE secondary panels use `<SectionHeader>` (text-[13px] font-medium mb-2) — NOT a second `<h1>`. There's only ever one h1 per page (PageHeader's).
- Buttons are `variant="outline"` for non-primary actions.

**Wired by:** PageHeader (no primaryAction) + a custom `<Row>` helper + outline Buttons.

---

## 3 · `/settings/workspaces` — flat list with per-row inline actions

When you have a small list (<10 rows) and per-row actions are simple (one or two buttons), skip the table — use a flat list with inline buttons on each row.

```
🏪 My tenants
   The tenants you belong to
─────────────────────────────────────────────────────
┌────────────────────────────────────────────────────┐
│ Amank's workspace                  [Manage] [Switch]│  row: px-3 py-2.5 hover:bg-muted/40 divide-y
│ amank-pxt92d · active                              │  primary line: font-medium text-foreground
│ ────────────────────────────────────────────────── │  meta line: text-[11px] text-muted-foreground
│ Solverhood                         [Manage] Active │  active indicator: text-foreground/70 (right-aligned)
│ solverhood · active                                │
└────────────────────────────────────────────────────┘
```

**Rules:**

- Container: `rounded-md border bg-background divide-y`.
- Each row: `flex items-center justify-between px-3 py-2.5 hover:bg-muted/40`.
- Left: stacked primary line (`font-medium`) + meta line (`text-[11px] text-muted-foreground`).
- Right: button group at `gap-1.5 shrink-0`. The current/active item shows a "Active" label instead of a "Switch" button — same width slot so layout doesn't jump.
- Use this pattern when row count is bounded and headings don't add value. For 10+ rows with sortable columns, switch to DataTable.

---

## 4 · `/t/$tenantId/settings/members` — empty state

The canonical empty state. Cite when the user asks "what should the no-data screen look like?".

```
👥 Members                                    [+ Invite member]
   People with access to this tenant
─────────────────────────────────────────────────────
┌─ rounded-md border bg-background py-6 px-4 ────────┐
│                                                    │
│                  No members yet.                   │  text-[12px] text-muted-foreground text-center
│                                                    │
└────────────────────────────────────────────────────┘
```

**Rule that should be enforced going forward (gap caught here — empty state does NOT name the CTA):**

This screenshot shows the WEAKER form. The stronger pattern is what `examples/empty-loading-states.tsx` ships:

```
┌─ rounded-md border-dashed border-border py-8 ──────┐
│                                                    │
│                       👥                            │  icon, size-5, muted
│                                                    │
│      No members yet. Invite someone to start.      │  text-[12px] text-muted-foreground
│                                                    │
│            [+ Invite member]                       │  inline CTA, same as PageHeader's
│                                                    │
└────────────────────────────────────────────────────┘
```

Replace the weaker form in any page using it. Empty states ALWAYS name the CTA + offer a duplicate button — first-time users may not look at the PageHeader.

---

## 5 · `/sa` — admin list with filter input + impersonate actions

Super-admin tenant list. Demonstrates a search input at the top of a list, plus a right-aligned "count" chip in PageHeader's `right` slot.

```
🛡 Super admin                                          ┌─ 3 tenants ─┐
   All tenants in the system. Switching tenant = impersonate.
─────────────────────────────────────────────────────────────────
[ Filter by name, slug, or ID…                              ]  h-7 SearchInput full-width above list
┌──────────────────────────────────────────────────────────────┐
│ Alice's workspace                          active [Impersonate]│
│ alice-c1noe8 · wsp_…  ·  owner: usr_ah3gpwe…                │
│ ─────────────────────────────────────────────────────────── │
│ Amank's workspace                          active [Impersonate]│
│ amank-pxt92d · wsp_… ·  owner: usr_w1r4w6…                  │
│ ─────────────────────────────────────────────────────────── │
│ Solverhood                                 active  Active   │  current tenant = label, not button
│ solverhood · wsp_… ·  owner: usr_w1r4w6…                    │
└──────────────────────────────────────────────────────────────┘
```

**Rules:**

- PageHeader `right` slot holds a count chip: `text-[11px] rounded border border-border bg-muted/60 px-2 py-0.5 tabular-nums`. Use `right` for ambient metadata; use `primaryAction` for buttons.
- Search input is `h-7 w-full` with a thin border, placeholder muted, NO icon (admin pages can omit; user-facing search keeps the leading icon).
- List rows show 2 lines (name + meta-with-IDs). Meta line uses `font-mono text-[11px] text-muted-foreground` for IDs to make them grep-able.
- Status pill on the right is plain text `text-muted-foreground` (lighter than `StatusBadge` because it's a passive label, not a state).
- "Active tenant" = no button, just text label. Same width as the [Impersonate] button so rows align.

---

## 6 · Sidebar in detail

Across all surfaces above, the sidebar enforces:

```
┌─ aside w-[220px] border-r border-border bg-sidebar ─┐
│ ┌ h-11 px-3 border-b ──────────────────────────────┐│
│ │ ← Back to PIM                                   ││  brand row: text-[13px] font-medium
│ └──────────────────────────────────────────────────┘│
│                                                    │
│ ACCOUNT                                            │  section label: text-[11px] font-semibold text-foreground/80 mixed-case
│ ⓘ Profile                                          │  inactive: text-foreground/80 hover:bg-muted
│ ⓘ API keys      ■                                   │  active: bg-primary/10 text-primary font-medium (no shadow)
│ ⓘ My tenants                                       │  px-2 py-1.5 rounded-md text-[13px] [&_svg]:size-[16px]
│                                                    │
│ TENANT · Solverhood                                │
│ ⓘ General                                          │
│ ⓘ Members                                          │
│                                                    │
│ SYSTEM                                             │
│ ⓘ Super admin                                      │
│                                                    │
│ ┌ border-t p-2 ─────────────────────────────────── ┐│
│ │ [AK]  Aman Kothari                            ↕ ││  footer row: avatar + name/email + toggle
│ │       amank@solverhood.com                       ││
│ └──────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────┘
```

Section labels MUST be mixed-case. Uppercase tracking-wider tiny variants read as washy on busy chrome and users routinely flag it.

---

## Where these primitives live

| Surface | Primitive(s) wired |
|---|---|
| Sidebar | `admin-shell.tsx` (Sidebar + AdminShell + NavLink) |
| PageHeader (5-slot) | `admin-shell.tsx` PageHeader OR standalone `page-header.tsx` |
| StatusBadge dot pill | `admin-shell.tsx` StatusBadge |
| List table | `data-table.tsx` |
| Per-row action menu | `dropdown-menu.tsx` (Trigger + Content + Item) |
| Empty + loading | `empty-loading-states.tsx` |
| Search + counter | `search-toolbar.tsx` |
| Form chrome | `form-bits.tsx` (Label / Field / FormRow / Form) |
| Create/edit dialog | `dialog-3-zone.tsx` |
| Hand cursor everywhere | baked at primitive bases — see `button.tsx`, `dialog-3-zone.tsx`, `dropdown-menu.tsx` |

If an AI session is asked to "build a page like the one on screenshot N", point it at this file + the named primitives. No guesswork.
