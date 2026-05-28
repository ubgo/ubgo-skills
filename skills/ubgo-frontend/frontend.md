# Frontend Rules — generic (drop-in)

**Read before:** ANY change to TypeScript / React / `.tsx` / styling. Project-agnostic. Project-specific overrides live in a sibling `frontend-project.md`; read both before substantive frontend work. If the repo has an `.aicoder/` / `.lore/` / `.codeskill/` store, query its rules + hotfixes first — they are authoritative on conflict.

> Authoring note: plain markdown rendered by GitHub + filemark. Single physical lines for prose (no hard-wrap). Tables, fenced code, and frontmatter are the only line-break exceptions.

---

## 0 · The 5 commandments

1. **NO inline GraphQL strings.** Every query / mutation / subscription goes through the generated SDK (`src/generated/sdk/` — gqlkit). After backend schema change: `task gqlkit:all`. Raw template-literal `query \`{ ... }\`` is banned. The SDK is the single source of truth for the wire contract.
2. **NO `useEffect` for data fetching.** TanStack Query for server state (`useQuery` / `useMutation`). `useEffect` is for DOM-side-effects + subscriptions only. Fetching in `useEffect` defeats caching, dedup, refetch-on-focus, and the entire reason Query exists.
3. **NO native `window.alert` / `window.prompt` / `window.confirm`.** Use a styled React component every time. Destructive confirmation goes through the project's `<ConfirmDelete>` (path in overlay). Single-value text capture goes through a Dialog with an Input. Native dialogs look unprofessional, can't be styled, block JS, and are dismissed by the browser chrome not the app.
4. **NO raw HTML `<select>` / `<option>`.** Every dropdown uses the project's `<EnumSelect>` (or shadcn `Select`) backed by a `*_OPTIONS` array. Even temporarily. Even inside a Dialog/Drawer/Sheet. Even as a "quick scaffold." Pre-submit grep on any form-touching diff: `<select` and `<option` must both be zero.
5. **NO Radix.** The project has migrated off `@radix-ui/*`. Primitives come from `@base-ui/react` (basecn) wrapped via shadcn-style components in `src/components/ui/`. When the user says "shadcn" they mean basecn (Base UI + Tailwind v4). `asChild` → use Base UI's `render` prop (a shared `asChildProp()` helper at `@/lib/utils` bridges).

Violate one of those five → stop and ask before continuing.

---

## 1 · Stack (consistent across every frontend we ship)

We use the same libraries everywhere. If you're tempted to introduce an alternative, the answer is almost always no — extend the wrapper, don't bypass it.

| Concern | Library | Notes |
|---|---|---|
| Framework | **TanStack Start** (React 19 + Vite + Nitro SSR) | File-based routing, SSR-by-default |
| Router | `@tanstack/react-router` | `createFileRoute()` per file under `src/routes/` |
| Server state | `@tanstack/react-query` v5 | Never `useEffect` for fetch |
| Client state | `@tanstack/store` | Global UI state only; not for server data |
| Forms | `@tanstack/react-form` | Headless, type-safe |
| Tables | `@tanstack/react-table` v8 | Headless; wrap into `<DataTable>` |
| Virtual | `@tanstack/react-virtual` | Long lists / virtualized grids |
| Validation | `zod` v4 | Runtime + type extraction |
| GraphQL client | **gqlkit-ts** generated SDK | `src/generated/sdk/` — never edit, never bypass |
| RPC (secondary) | `tRPC` / `oRPC` | Allowed but GraphQL is primary |
| ORM (server only) | `drizzle` | Server-only; never imported in client code |
| UI primitives | `@base-ui/react` (basecn) | Replaces Radix; never reintroduce `@radix-ui/*` |
| Components | shadcn-style under `src/components/ui/` | Don't build custom when shadcn has it |
| Icons | `lucide-react` ONLY | No mixing icon libraries |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | Utility classes only; no CSS modules / styled-components |
| Toast | `sonner` | `toast.success / .error` |
| Markdown | `streamdown` (+ plugins) | Not raw `markdown-it` |
| Editor | Monaco / Excalidraw / TLDraw | Behind `clientOnly()` boundary (SSR-unsafe) |
| Drag & drop | `@dnd-kit/*` | Core + sortable + utilities |
| DataStore (kanban) | `@tanstack/react-table` + `@dnd-kit` | No commercial datagrids |
| Sentry | `@sentry/react` | Boot via `instrument.server.mjs` for SSR |
| Lint | **oxlint** | Replaces ESLint |
| Format | **oxfmt** | Replaces Prettier |
| Type | TypeScript 5+ strict | `target: ES2022`, `moduleResolution: bundler` |
| Package mgr | `pnpm` | Lockfile is `pnpm-lock.yaml` |
| Build | `vite` + `nitro` | `pnpm build` → `.output/` |
| Test | `vitest` + `@testing-library/react` + `jsdom` | `*.test.ts(x)` colocated |

**Do not use:**

- `@radix-ui/*` — banned; use `@base-ui/react` via basecn (the rule is hard; do not reintroduce even "just for this one component")
- raw `fetch()` for GraphQL — use the generated SDK
- `useEffect` + `fetch()` for data — TanStack Query
- `prettier` / `eslint` — oxfmt / oxlint
- CSS modules / styled-components / emotion — Tailwind utilities
- Multiple icon libraries — Lucide only
- `window.alert / .prompt / .confirm` — styled React Dialog
- Native `<select>` — `<EnumSelect>` / `<Select>`
- `npm` / `yarn` — pnpm
- Magic numbers in JSX (`width: 387`) — Tailwind tokens or theme vars

---

## 2 · TypeScript

### Strict, always

`tsconfig.json` invariants:

```json
{
  "strict": true,
  "target": "ES2022",
  "jsx": "react-jsx",
  "moduleResolution": "bundler",
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedSideEffectImports": true,
  "skipLibCheck": true,
  "paths": { "@/*": ["./src/*"] }
}
```

**Path alias `@/*` → `./src/*`** everywhere. No relative `../../../` chains.

### `type` over `interface`

Use `type` for component props, response shapes, unions, discriminated unions. Reserve `interface` for declaration merging (rare).

```tsx
// Good
type ButtonProps = {
  variant?: "default" | "ghost"
  size?: "sm" | "md" | "lg"
  onClick?: () => void
}

// Avoid (interface)
interface ButtonProps { ... }
```

### `any` is banned

If you can't express a shape, use `unknown` and narrow with `instanceof` / `typeof` / a Zod schema. `any` slips into `as any` casts that silently lie about the wire format. CI lint should flag.

### Branded types for IDs

When IDs are opaque (`prj_…`, `tsk_…`, `usr_…`), brand them so you can't accidentally pass a task ID where a project ID is expected:

```ts
type ProjectId = string & { readonly __brand: "ProjectId" }
type TaskId = string & { readonly __brand: "TaskId" }
```

### Props patterns

Explicit `Props` type (not inline), spread DOM rest:

```tsx
type InputProps = React.ComponentProps<"input"> & { invalid?: boolean }

export function Input({ className, invalid, ...props }: InputProps) {
  return <input data-slot="input" aria-invalid={invalid} className={cn(base, className)} {...props} />
}
```

---

## 3 · GraphQL — gqlkit SDK only

**Where the SDK lives:** `src/generated/sdk/` (auto-generated; NEVER edit).
**Regenerate:** `task gqlkit:all` after backend schema change.
**Schema fetched from:** `src/scripts/api/schema-introspected.graphql` via the gqlkit config.

**Pattern (do):**

```tsx
import { sdk } from "@/lib/gql-clients"

function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => sdk.projects().select(f => f.id().name()).execute(),
  })
}
```

**Anti-pattern (don't):**

```tsx
// BANNED — inline string
const query = `query { projects { id name } }`
const res = await fetch("/api/dash/query", { body: JSON.stringify({ query }) })
```

### Batching

`batch(client, {...})` from gqlkit-ts is currently broken (`getOpFragment is not a function` — generated builders don't forward the method). Use `Promise.all([...execute(), ...execute()])` until codegen is fixed. Costs one round-trip per query but works.

### Watch for `entgql.Skip(SkipMutationCreateInput, SkipMutationUpdateInput)`

When an ent field is annotated `SkipMutations`, neither `CreateXxxInput` nor `UpdateXxxInput` carries it. Frontend can send the key, backend silently ignores — bug looks like "save does nothing." Audit all `SkipMutations` annotations whenever a save-no-op bug appears.

---

## 4 · Components & UI

### Layer

```
@base-ui/react primitives
        ↓
src/components/ui/<thing>.tsx   (shadcn-style wrapper, data-slot, cn(...))
        ↓
src/components/<feature>/...    (composed feature components)
        ↓
src/routes/...                  (pages assembling features)
```

### File naming

- **Components**: PascalCase files (`UserProfile.tsx`)
- **Directories**: lowercase-kebab (`entity-kit/`, `smart-rich-editor/`)
- **Hooks**: `use<Thing>.ts` (`useKeyboardShortcuts.ts`)
- **Routes**: file-based per TanStack Router (`prj.$projectId.board.tsx` or folder form)
- **Utilities**: kebab-case (`gql-clients.ts`, `auth-fetch.ts`, `use-delayed-flag.ts`)

### Boolean prefixes

`is*` / `has*` / `should*` — `isLoading`, `hasError`, `shouldOpen`. Bare booleans (`loading`, `error`) get confused with state objects.

### `data-slot` for styling hooks

Every shadcn wrapper exposes a `data-slot="<name>"` attribute. Don't strip it. Project CSS keys off it.

```tsx
<InputPrimitive data-slot="input" className={cn(base, className)} {...props} />
```

### `asChild` → Base UI `render`

Base UI uses `render` prop instead of Radix's `asChild`. The shared bridge:

```ts
// @/lib/utils
export function asChildProp(
  asChild: boolean | undefined,
  children: React.ReactNode,
): { render?: React.ReactElement; children?: React.ReactNode } {
  if (asChild && React.isValidElement(children)) return { render: children }
  return { children }
}
```

Use it when wrapping a Base UI component that needs to accept either a child or a render-prop pattern.

### `cn(...)` everywhere

Use the shared `cn` (clsx + tailwind-merge) for className composition. Never raw string concatenation — class merges (e.g. `p-4` overridden by `p-6`) silently lose precedence without `tailwind-merge`.

### Composition over inheritance

No class components. Hooks + functional composition + render-prop / children-as-function when needed. No `extends`, no HOCs unless framework-required.

---

## 5 · Design tokens (taste, not negotiable)

The project's `styles.css` defines a compact, dense-UI token system. Don't override per-component; extend the theme.

### Fonts

- **Display**: `Fraunces` (serif, optical sizing) — class `font-display`. Page titles, headings, marketing copy. Use sparingly.
- **Body**: `Geist Variable` — `--font-sans`, default. Loaded via `@fontsource-variable/geist`. All body text + inputs + UI chrome.
- **Mono**: `Geist Mono Variable` — `--font-mono`, class `font-mono`. Code, version numbers, IDs, timestamps. **Always pair with `tabular-nums`** for numeric data so columns align.

**Never render data in the body font.** Versions / counts / timestamps / IDs go in mono + tabular-nums. Mixing breaks visual hierarchy.

**Font features:** body sets `font-feature-settings: "ss01", "cv11"` (Geist OpenType variants) + antialiased smoothing + `text-rendering: optimizeLegibility`.

### Type scale (compact, dense)

```
2xs  0.6875rem (11px)   — micro labels, chip text
xs   0.75rem   (12px)   — caption, meta
sm   0.8125rem (13px)   — secondary
base 0.875rem  (14px)   — body default ★
md   0.9375rem (15px)
lg   1.0625rem (17px)
xl   1.25rem   (20px)
2xl  1.5rem    (24px)
3xl  1.875rem  (30px)
4xl  2.5rem    (40px)
5xl  3.5rem    (56px)
6xl  4.5rem    (72px)
```

`base = 14px` is the body default — this is a dense UI, not a marketing site. Don't drift toward 16px without intent.

### Colors (oklch, dark-first + light theme)

Token vars in `:root` (light) + `.dark` overrides. Semantic names only at the component layer:

```
background, foreground, card, popover,
primary, secondary, muted, accent, destructive,
border, ring, input,
surface-1, surface-2, surface-3   (extended palette)
```

**Primary** is teal/emerald (`oklch(0.58 0.15 162)`). **Never** ship a default Tailwind blue primary button without explicit intent. **Accent** is amber-signal — use sparingly. **Status colors**: `.status-active`, `.status-removed`, `.status-unknown` exist as utilities — prefer those over reinventing chips.

### Radius

`--radius: 0.5rem` base; derived: xs (0.25), sm, md (0.5), lg (0.75), xl (1), 2xl (1.25), 3xl (1.75). Pick from the scale; no `rounded-[7px]` randomness.

### Spacing

Tailwind defaults. Standard component paddings: tight `p-2/p-3`, default `p-4`, generous `p-6`, hero `p-8`. Compact controls (`h-8` buttons + inputs) use `px-2.5 py-1`.

### Hairline rules

Prefer **hairline rules** over heavy borders. Use the project's `.hairline` utility OR `border-border/60`. Heavy `border-2` reads as a draft, not a finished product.

### Motion

```
duration: instant 50ms, fast 150ms, base 200ms, slow 300ms
easing:   ease-out-expo cubic-bezier(0.16, 1, 0.3, 1)
          ease-in-out-soft cubic-bezier(0.65, 0, 0.35, 1)
```

`tw-animate-css` for complex sequences; Tailwind v4 animates for primitives. Don't author bespoke `@keyframes` per component.

### Dark mode

Class-based (`.dark` on `<html>`). Tokens swap via CSS variables in `styles.css`. Never hardcode `bg-white` / `text-black` — use semantic tokens.

### Ship-gate (taste, enforced on review)

- No default Tailwind blue primary button without intent.
- No generic rounded-card + Inter admin dashboard ("AI slop").
- No heavy borders — hairline rules.
- Always pair a display font with body + mono — never render data in the body font.
- Commit to one conceptual direction (editorial / brutalist / terminal / etc.) — not "modern SaaS."
- Tabular numbers wherever digits align in columns.

---

## 6 · Forms — TanStack Form + Zod

### Pattern

```tsx
import { useForm } from "@tanstack/react-form"
import { z } from "zod"

const Schema = z.object({
  title: z.string().min(1, "required"),
  priority: z.enum(["LOW", "HIGH"]),
})

function CreateThing() {
  const form = useForm({
    defaultValues: { title: "", priority: "HIGH" as const },
    validators: { onSubmit: Schema },
    onSubmit: async ({ value, formApi }) => {
      await sdk.createThing(value).execute()
      formApi.reset()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            aria-invalid={field.state.meta.errors.length > 0}
          />
        )}
      </form.Field>

      <form.Field name="priority">
        {(field) => (
          <EnumSelect
            value={field.state.value}
            options={PRIORITY_OPTIONS}
            onChange={(v) => field.handleChange(v as Priority)}
            className="w-full justify-between h-9"
          />
        )}
      </form.Field>

      <Button type="submit" disabled={form.state.isSubmitting}>Save</Button>
    </form>
  )
}
```

### Input sizing

Default control height **`h-8`** (compact), padding `px-2.5 py-1`, radius `rounded-lg`, focus `focus-visible:ring-3 focus-visible:ring-ring/50`, invalid `aria-invalid:border-destructive aria-invalid:ring-destructive/20`.

### Submit state

- Button: `disabled={form.state.isSubmitting}` + replace label with spinner.
- Never re-disable the form after success without resetting — users get stuck.
- Toast on success/error via `sonner` (`toast.success("Saved")` / `toast.error(...)`).

### Hard rules (recap)

- **No raw `<select>` / `<option>`** — always `<EnumSelect>` with a `*_OPTIONS` array. Pre-submit grep your diff.
- **No `window.confirm`** for destructive — use the project's `<ConfirmDelete>`.
- **No `window.prompt`** for text capture — Dialog with a single Input.

---

## 7 · Data fetching — TanStack Query

### Basic shape

```tsx
function useProject(id: ProjectId) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => sdk.project({ id }).execute(),
    enabled: !!id,
  })
}

function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) => sdk.updateProject(input).execute(),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project", vars.id] })
    },
  })
}
```

### Query keys

Tuple-typed, stable, hierarchical. `["project", id]` invalidates from `["project"]`. Never anonymous objects as keys (referential identity changes each render).

### Loading & error states

Read from the hook (`isLoading`, `isError`, `error`). Never roll your own loading state with `useState + useEffect`.

### Skeletons gated by `useDelayedFlag`

Every route/page that renders a `<Skeleton/>` on loading MUST gate it behind `useDelayedFlag(loading, 150)` — otherwise fast-resolving loads (<150ms) flash a skeleton on every navigation. The ONLY sanctioned shape:

```tsx
import { useDelayedFlag } from "@/lib/use-delayed-flag"

const { isLoading } = useProject(id)
const showSkeleton = useDelayedFlag(isLoading)

return showSkeleton ? <ProjectSkeleton /> : <ProjectView ... />
```

### Cached shell fetches

Any **always-mounted shell** component (AuthGate, Sidebar, WorkspaceSwitcher, AuthFooter) that fetches must use a **module-level cached singleton promise** in `@/lib/auth.ts` — not a `.execute()` per mount. AuthGate's loading→children remount + StrictMode dev double-invoke + multiple callers multiply identical shell queries (e.g. AuthMe ×3, MyWorkspaces ×2).

Pattern:

```ts
let mePromise: Promise<Me> | null = null
export function getMe() {
  if (!mePromise) mePromise = sdk.me().execute().catch((e) => { mePromise = null; throw e })
  return mePromise
}
export function resetMe() { mePromise = null }
```

Call `resetMe()` on login / logout / token-clear, and `reset<X>()` after any mutation that changes the data. Don't cache rejections.

### Auth refresh on 401

Pass an `authFetch` wrapper as gqlkit `ClientOptions.fetch` for ALL authenticated clients. It (1) overrides Authorization from storage on every request (clients outlive tokens), (2) detects HTTP 401 OR gqlgen's GraphQL-error reject (`200 + errors[].message =~ /unauthorized/i`), (3) runs ONE module-deduped `refresh()` (dynamic import to avoid cycle), (4) retries once with the new token, (5) on refresh failure → `window.location.href = "/login"`. The anon client (login/register/refresh itself) MUST NOT use `authFetch`.

---

## 8 · Client state — TanStack Store

For genuinely global UI state (sidebar collapsed, active workspace, theme, command palette open). Not for server data.

```ts
import { Store, useStore } from "@tanstack/store"

export const sidebarStore = new Store({ collapsed: false })

export function useSidebar() {
  const collapsed = useStore(sidebarStore, (s) => s.collapsed)
  return { collapsed, toggle: () => sidebarStore.setState((s) => ({ collapsed: !s.collapsed })) }
}
```

Local UI state (open/closed, hover, transient draft) stays in `useState`. Don't reach for a store when `useState` works.

**`useSyncExternalStore` trap:** any new external store subscriber must back its `getSnapshot` with a **token-keyed cache** (bump a token on mutation, cache the snapshot keyed on the token, return cached when unchanged). Allocating a fresh array/object on every plain read triggers "Maximum update depth exceeded."

---

## 9 · Routing — TanStack Router (file-based)

### Route file

```tsx
// src/routes/prj/$projectId/board.tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/prj/$projectId/board")({
  component: BoardPage,
})

function BoardPage() {
  const { projectId } = Route.useParams()
  return <Board projectId={projectId} />
}
```

### Root + context

`src/routes/__root.tsx` uses `createRootRouteWithContext<MyRouterContext>()`. Context carries `queryClient`, `trpc`, `orpc`. Providers (Query, Store, Auth, Keyboard) wrap inside the root component.

### routeTree regen

`src/routeTree.gen.ts` is auto-generated by the TanStack Start Vite plugin **on `vite dev` / `vite build`**. There is no `task routes:gen`. **`npx tsr generate` is a no-op in this setup** — do not trust it. After moving/renaming a route file: start `vite dev` (or run `vite build`), then `grep "from './routes/<old-flat-dotted>'" src/routeTree.gen.ts` must return zero. Independently verify before committing.

### Flat-file path-nesting gotcha

A filename like `prj.$projectId.lib.$sourceId.edit.tsx` generates `/prj/$projectId/lib/$sourceId/edit` as a **child** of `/lib/$sourceId`. If the parent route's component doesn't render `<Outlet/>`, the child never mounts — clicking "Edit" looks like a silent nav failure (URL changes, view stays). Fix: reorder filename to flatten — `prj.$projectId.lib.edit.$sourceId.tsx` → sibling route at `/prj/$projectId/lib/edit/$sourceId`.

### Reading params/search

```tsx
const { projectId } = Route.useParams()
const search = Route.useSearch()
```

When NOT inside the typed route (a "global" component), use `useParams({ strict: false })` and pattern-match the current project URL prefix: `location.pathname.match(/^\/prj\/([^/]+)/)?.[1]`. Historical components used a `/workspace/<id>` pattern that doesn't exist in this app → `projectId` always resolved `undefined`. Audit grep: `grep -rn '/workspace/' src/components/ src/features/ --include='*.tsx'` must return zero (except the workspace-settings UI itself).

### `beforeLoad` guards

Redirects on auth / route-level prereqs:

```tsx
export const Route = createFileRoute("/workspace/")({
  beforeLoad: () => { throw redirect({ to: "/projects", replace: true }) },
  component: () => null,
})
```

---

## 10 · Dialogs, Sheets, Drawers

### Dialog max height (apply once, fixes the whole repo)

Default shadcn `Dialog` only centers via translate — no `max-height`, no `overflow`. Long content (Textarea bound to markdown body, multi-section Edit dialog, long Select list) bleeds off the viewport top + bottom and users report "I can't scroll" / "can't reach Save."

Fix in `src/components/ui/dialog.tsx` `DialogContent` base class — once:

```
max-h-[calc(100dvh-2rem)] overflow-y-auto
```

Use **`dvh`** (dynamic viewport height) not `vh` — `vh` excludes mobile URL bar even when hidden. Override per-dialog only when the dialog has its own scroll container child; add `overflow-visible` explicitly when overriding. Audit: `grep -nE 'max-h-' src/components/ui/dialog.tsx` must show `calc(100dvh-2rem)` on `DialogContent` base.

### Sheet width — inline style or you lose

shadcn `Sheet` bakes these into `SheetContent`:

```
data-[side=right]:w-3/4
data-[side=right]:sm:max-w-sm
```

Tailwind's data-attribute variant is more specific than a plain breakpoint variant. **`className="sm:w-[480px]"` is a no-op** — base data-attr classes win at runtime even if `tailwind-merge` doesn't flag the conflict. The drawer renders at 1296px OR clamps to 384px regardless. The only reliable override:

```tsx
<SheetContent style={{ width: "480px", maxWidth: "100vw" }} className="p-0 ...">
```

For resizable drawers: drive width from `useState` via inline `style`. Inline `maxWidth: '100vw'` is the mobile safety bound — a stored large width clamps on small screens.

### Native dialogs banned (recap)

`window.alert / window.prompt / window.confirm` are banned. Destructive → `<ConfirmDelete>`. Text capture → Dialog with an Input. Three-way destructive with mode picker → project's `<DeleteFolderDialog>`-style component (path in overlay).

### Focus + escape

Base UI handles focus trap, escape-to-close, focus restoration on close automatically. Don't reimplement.

### Quick view system

For list-page entities with a detail view, **extend the existing `QuickViewContext` union** — do NOT build a local `<Drawer>`. Required edits when adding a new entity kind:

1. Build `Detail` component at `prj.$projectId.<short>.$<id>.tsx` with signature `({ <id>: string; onClose?: () => void } = {})`.
2. Extend `QuickViewContext.tsx` `QuickViewKind` union with the new kind.
3. In `QuickView.tsx`: import Detail, add to `KIND_LABEL`, add `Body` switch case, add `goFullPage` switch case (navigate to full route).
4. List rows: `<Link to=<detail-route>>` wrapping whole row + overlay `Eye + Pencil` icons revealed on `group-hover/row`. Reference: `components/task-system/knowledge/lists.tsx` `QuickViewEye`.
5. Reserve standalone `<Drawer>` / `<Sheet>` for non-entity panels.

---

## 11 · Tables & lists

### NEVER bare `<table>` for a list page — always the project's full datagrid

**Hard rule.** Any list page (entities, audit logs, settings rows, anything tabular with > one column) MUST use the project's full-featured server-data-table component, NOT a bare `<table>` / `<Table>` wrapper. The bare table gives you NOTHING — no sort, no filter, no search, no pagination, no saved views, no column show/hide, no row actions menu, no empty/error states, no density toggle. Every list page accumulates those features sooner or later; rebuilding them per page is wasted work and pages drift in subtle UX.

Canonical names across projects (one of these exists; find yours by `grep -rln "ServerDataTable\|DataTable\|EntityTable" src/components/ui/`):

- `ServerDataTable` (basecn projects)
- `DataTable` (shadcn projects)
- Project-specific equivalent

**Verify by grepping a sibling list page.** If `/metafields` / `/products` / `/collections` use `ServerDataTable`, the new entity's list page uses it too. Same shape, copy-paste pattern, fill in `columns` + `filterFields` + `sortOptions` + `queryFn`. Pages that don't follow this stick out as "messy" to anyone who knows the codebase.

**Audit failure mode.** If you ship a CRUD page with a hand-rolled `<Table>`/`<table>` + `.map(row => <TR>…</TR>)`, the user notices instantly. The fix is always: rip the table out, drop in `ServerDataTable` with the columns/filters/sort/actions config, keep the create/edit dialog beside it.

### Library

`@tanstack/react-table` (headless) wrapped into `src/components/ui/data-table.tsx` (or `server-data-table/`). Virtual rows via `@tanstack/react-virtual` when row count > a few hundred. DnD via `@dnd-kit/*`.

### ServerDataTable canonical shape (verbatim — copy this)

```tsx
import {
  type DataTableColumn,
  defineFilterFields,
  defineSortOptions,
  ServerDataTable,
} from "@/components/ui/server-data-table"
import { clientConnection } from "@/lib/client-datatable"
import { pimQuery } from "@/integrations/graphql-codegen/pim-fetch"
import { Pencil, Trash2, Eye } from "lucide-react"
import { EntityDocument, type EntityQuery } from "@/generated/graphql/graphql"

type Row = NonNullable<EntityQuery["pimEntities"]>[number]
type Where = { search?: string; kind?: string[]; status?: "active" | "draft" }

const cols: DataTableColumn<Row>[] = [
  { id: "code",   header: "Code",   size: 220, meta: { sortFieldId: "code", filterFieldId: "search" },
    cell: (r) => <span className="font-mono text-[13px] font-medium">{r.code}</span> },
  { id: "kind",   header: "Kind",   size: 140, meta: { sortFieldId: "kind" },
    cell: (r) => <KindChip kind={r.kind} /> },
  { id: "status", header: "Status", size: 100,
    cell: (r) => <StatusBadge status={r.status} /> },
]

const filterFields = defineFilterFields<Where>()([
  { id: "search", type: "text", label: "Search", placeholder: "code…",
    toWhere: (c) => ({ search: c.value ?? undefined }) },
  { id: "kind", type: "relation-multi", label: "Kind",
    loadOptions: (q) => loadDistinct("kind", q),
    toWhere: (c) => ({ kind: c.value }) },
  { id: "status", type: "select", label: "Status",
    options: [{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }],
    toWhere: (c) => ({ status: c.value as Where["status"] }) },
])

const sortOptions = defineSortOptions()([
  { fieldId: "code", label: "Code" },
  { fieldId: "kind", label: "Kind" },
])

<ServerDataTable<Row, Where>
  queryKey="pimEntities"
  views={{}}
  columns={cols}
  filterFields={filterFields}
  sortOptions={sortOptions}
  defaultSort={[{ fieldId: "code", direction: "asc" }]}
  getRowId={(r) => r.id}
  pageSize={25}
  rowActions={(row) => [
    { label: "Edit",   icon: Pencil, onAction: () => setEditing(row) },
    { label: "Delete", icon: Trash2, destructive: true, onAction: () => setDeleteTarget(row) },
  ]}
  emptyMessage="No entities yet"
  emptyDescription="Click 'New entity' to add the first one."
  queryFn={async (args) => {
    const data = await pimQuery<EntityQuery>(String(EntityDocument))
    return clientConnection(data.pimEntities ?? [], args, {
      filter: (r, where) => { /* apply where */ return true },
      sorters: { code: (r) => r.code.toLowerCase() },
    })
  }}
/>
```

**Pass the codegen-generated `*Document` to `pimQuery` via `String(…)`** — keeps type safety on the result while reusing the project's non-hook fetch path that `ServerDataTable.queryFn` requires.

### Per-row Actions — use `rowActions` prop, NOT a custom column

`ServerDataTable` ships a `rowActions` prop that renders a dropdown with `Edit`, `Delete` (+ quick-view `Eye` when applicable). Pass an array; don't add a custom Actions column that re-implements the same dropdown.

```tsx
rowActions={(row) => [
  { label: "Quick view", icon: Eye,    onAction: () => qv.push({ kind, id: row.id }) },
  { label: "Edit",       icon: Pencil, onAction: () => openEdit(row.id) },
  { label: "Delete",     icon: Trash2, destructive: true, onAction: () => openDeleteConfirm(row) },
]}
```

If you genuinely need inline icon buttons (e.g. starring, archiving — frequent single-click actions), add a custom column ALONGSIDE `rowActions` — don't replace it.

### List rows as `<Link>` + overlay icons (when row has a detail page)

When the entity has a detail page: the row IS a `<Link to="/<entity>/$id">`. Absolute-positioned overlay with hover-revealed `Eye + Pencil` via `group/row` + `group-hover/row:opacity-100`. Do NOT use clickable `<li onClick>` — accessibility (no `<a>`), no middle-click-to-open-tab, no copy-link-address.

When the entity does NOT have a detail page yet: skip the `<Link>`. The `rowActions` dropdown handles Edit/Delete. Add the `<Link>` wrapper later when the detail page ships.

### Per-row Actions column — MANDATORY

**Every table / datagrid / CRUD list MUST include a trailing Actions column** with at minimum quick-view (`Eye`) and edit (`Pencil`) ghost icon buttons. Click-on-row navigation is fine as a shortcut but **NOT a substitute**.

Canonical pattern:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="size-7"
  onClick={(e) => { e.stopPropagation(); qv.push({ kind, id: row.id }) }}
>
  <Eye className="size-3.5" />
</Button>
```

Lucide icons at `size-3.5`. Wrap cell click in `e.stopPropagation()` so the row's outer `<Link>` doesn't swallow it.

### List rows as `<Link>` + overlay icons

The row IS a `<Link to="/prj/$projectId/<short>/$<id>">`. Absolute-positioned overlay with hover-revealed `Eye + Pencil` via `group/row` + `group-hover/row:opacity-100`. Do NOT use clickable `<li onClick>` — accessibility (no `<a>`), no middle-click-to-open-tab, no copy-link-address.

---

## 12 · Page layout

### PageHeader needs an outer wrapper

`PageHeader` (project component) only renders `pb-5 + border-b`. It does NOT provide horizontal or top padding. Every route using `<PageHeader>` must wrap it. Two valid wrappings:

```tsx
// Constrained content pages
<div className="max-w-[1200px] mx-auto px-6 py-8">
  <PageHeader>...</PageHeader>
  ...
</div>

// Full-width / multi-column pages
<div className="px-6 pt-6">
  <PageHeader>...</PageHeader>
  ...
</div>
```

Bug class: page wraps `PageHeader` directly inside `flex h-full flex-col` with no inner padding → title + actions stick to viewport edges.

### Container max-widths

Constrained reading pages: `max-w-[1200px] mx-auto`. Boards / multi-pane / dense data tables: full-width. No magic widths; pick one of the two.

### `overflow-auto` + `h-full`

Every viewer / preview / scrollable inner panel MUST be `h-full w-full overflow-auto` (or `flex-col h-full overflow-hidden` with an internal `flex-1 overflow-auto` child). Inside fixed-height parents (e.g. a 320px drawer preview slot) OR `overflow-hidden` parents, missing `h-full` causes content overlay onto siblings OR clipping without a scrollbar. The parent slot MUST also clip (`overflow-hidden`) so children can't escape.

---

## 13 · SSR safety (TanStack Start / Nitro)

### `localStorage` — never bare

Nitro SSR exposes a `localStorage` global that is NOT a real `Storage`. It has NO `getItem()`. `typeof localStorage === "undefined"` returns `"object"` (passes the guard) → next line `localStorage.getItem(...)` throws `TypeError: localStorage.getItem is not a function` → unhandled → GET / returns 500 for EVERY route (because the offending module is imported transitively from a shell component, runs on every SSR render).

Route ALL `localStorage` reads through:

```ts
function lsGet(key: string): string | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage
    if (!ls || typeof ls.getItem !== "function") return null
    return ls.getItem(key)
  } catch { return null }
}
```

**Never bare `localStorage.getItem` at module / SSR-reachable scope.** `setItem` writes are client-only paths (event handlers / useEffect) so lower risk but prefer the same guard.

### Barrel import cycles

When repointing a **shared infra** module (`gql-clients.ts`, `env.ts`, anything pulled in transitively by a feature itself) to a modularized feature, **deep-import the concrete file** (`@/features/auth/active-workspace`), NEVER the barrel (`@/features/auth`). The barrel pulls the feature's own files, which import the shared infra, which re-imports the barrel — init cycle → `TypeError: (0, __vite_ssr_import__.getXxx) is not a function`. Feature→feature and component→barrel imports are fine; only the **shared-infra-into-barrel** edge cycles. Add a comment at the deep-import explaining why.

### Mount always-rendered shell BEFORE auth gates

Components that should reflect the current route regardless of auth state (`TitleSync`, analytics, breadcrumbs, telemetry) MUST mount in the always-rendered layer of `__root.tsx`, NOT inside `<AuthGate>` / `<QuickViewProvider>`. Otherwise `document.title` stays at the SSR placeholder until session resolves (200ms+ first nav, forever if routed to `/login`).

### `clientOnly` for canvas-heavy editors

`@excalidraw/excalidraw`, `tldraw`, Monaco are NOT TanStack Start-compatible via `React.lazy()` — hydration crashes with `<AwaitInner>` error fallback → blank page. Wrap with TanStack's `ClientOnly` boundary (or equivalent suspense-safe client-only pattern). Vite optimized-deps reload does NOT recover.

### Vite optimizeDeps + SSR config

`vite.config.ts` typically pre-includes heavy deps + marks them `noExternal` for SSR. Don't fight it; extend the include list when adding new canvas / WASM libs.

---

## 14 · Auth pattern

- Gate at `src/routes/__root.tsx` via `<AuthGate>`. Silent refresh before forcing login.
- Public routes: `/login`, `/api/*`, `/oauth/*`.
- Tokens: access + refresh in `localStorage` (read via `lsGet`).
- Module-level cached `getMe()` / `getMyWorkspaces()` with `resetMe()` / `resetMyWorkspaces()` after mutations.
- `authFetch` wrapper on EVERY authenticated gqlkit client (handles 401 + GraphQL `"unauthorized"` errors, dedups refresh, retries once, redirects to `/login` on refresh failure).
- Workspace switch: do NOT `window.location.reload()`. Wrap routed subtree in `<WorkspaceScope>` with `key={activeWorkspace}` — key change remounts the routed subtree, app shell stays mounted. Subscribe to `WORKSPACE_EVENT` + `storage` (cross-tab).

---

## 15 · Keyboard system

### One window-keydown listener — the provider's

The project ships a single keyboard provider with a capture-phase `window` keydown listener. **Do NOT add new `window.addEventListener("keydown", ...)`** anywhere. Audit: `grep -rn 'addEventListener.*keydown' src/` — every match either uses `useKeyboardShortcut` or has an explicit conflict opt-out comment.

### Always `preventDefault() + stopPropagation()`

When the dispatcher consumes a keystroke (fires a matched binding OR pushes a sequence prefix), call BOTH:

```ts
event.preventDefault()      // suppress native (e.g. Cmd+P print)
event.stopPropagation()     // suppress other window listeners
```

Capture-phase fires first but doesn't stop bubble — without `stopPropagation` legacy listeners (e.g. an inner `ServerDataTable`'s own `?` / `c` / `f` handler) ALSO fire on the same keystroke.

### Two-pass dispatch when `sequenceBuffer` is non-empty

For chord support (`g .`, `c t`, etc.), run two passes:

1. Bindings with a space in their key (sequence form).
2. Fall through to single-key / combo bindings.

Otherwise `g .` and standalone `.` both match the second keystroke; first registered wins → flips with HMR.

### Don't bind both `?` and `Shift+?`

`?` is literally Shift+/ on US keyboards: `event.key === "?"` AND `event.shiftKey === true`. Both `{ key: "?" }` and `{ key: "Shift+?" }` match the SAME keystroke. Pick one. Same trap for every shift-required literal: `! @ # $ % & * ( ) _ + { } | : " < > ? ~`. If you need a second cheatsheet depth, use a different modifier (`F1`, `Cmd+/`).

### Auto-create scope on demand

React effects fire BOTTOM-UP — children's `useKeyboardShortcut(scope, ...)` `useEffect` runs BEFORE the parent's `useKeyboardScope(scope)`. So children try to register into a scope that hasn't been pushed yet. Fix: `addBinding`/`addToScope` creates the scope on demand if it isn't there; parent's later push merges opts in place. Don't fight it with sync push in render.

### DropdownMenu typeahead trap

Base UI / Radix `DropdownMenu` intercepts every printable keystroke at its content root for built-in typeahead. An `<input>` placed inside `DropdownMenuContent` never receives keystrokes. Wrap inputs in a `div` with `onKeyDown={(e) => e.stopPropagation()}`:

```tsx
<DropdownMenuContent>
  <div onKeyDown={(e) => e.stopPropagation()}>
    <input ... />
  </div>
  {/* DropdownMenuItem children — typeahead still works here */}
</DropdownMenuContent>
```

Same trap for `ContextMenuContent` / `SelectContent`. For real search, reach for the `Command` (cmdk) primitive instead.

---

## 16 · Mentions / entity links

Mention links in prose are **relative** — `MentionTextarea` inserts `/t/<id>`, `/m/<id>`, `/lib/<id>`. The `EntityAnchor` component in `components/task-system/EntityShell.tsx` renders them as styled chips AND resolves to the full `/prj/$projectId/<short>/$id` via `useParams({ strict: false })`.

When adding a new entity to the mention system, you MUST update TWO places:

1. `MentionTextarea.KIND_PATH` (insert link).
2. `EntityAnchor.ENTITY_KIND_FROM_PATH` + matching regex (render + navigate).

Forget either → links 404.

### Legacy URL compat

When renaming a mention link format (e.g. `/library?source=<id>` → `/lib/<id>`), already-saved body markdown KEEPS the old form. Backfilling DB bodies is risky + easy to forget. Instead: add the legacy URL pattern to `EntityAnchor`'s matcher so old AND new bodies both resolve. Match canonical first (`^/(lib|[tspdm])/(id)$`), then fall through to legacy patterns, rewriting to the canonical `<Link>` target. Document the legacy pattern with a comment so future renames don't strip it.

---

## 17 · Media / file grids

When building any UI surface that renders media thumbnails in a grid (media list, collection detail, trash view, attachment picker), **DO NOT roll a local card component**. Use the shared `FileGrid + FileCard` at `src/components/media/FileGrid.tsx`.

Feature-flagged via optional props: `row`, `onClick`, `projectId` (enables ExternalLink → single-page route), `onQuickView` (Eye → MediaDetailDrawer), `selectable / selected / selectionMode / onToggleSelect` (green check badge + ring), `draggable / onDragStart` (DnD-to-folder), `positionLabel`.

### Bulk-select pattern

Parent owns `useState<boolean>(false)` for `selectionMode` + `useState<Set<string>>()` for selected. Header has a "Select" button — variant flips to filled when ON, label flips to "Done". When `selectionMode=true`, whole-tile click → `onToggleSelect` (not `onClick`/lightbox). Hover action cluster hides. Selection check badge in top-right.

---

## 18 · Toasts, errors, loading

- **Toast**: `sonner`. `toast.success("Saved")`, `toast.error("Failed: " + msg)`. Don't reinvent.
- **Error boundary**: per-route boundary. Display a useful message + a "go back" / "retry" button — not just "Something went wrong."
- **Server errors**: gqlgen returns `200 + errors[]`. The Query hook surfaces them via `error`. Display in-line near the failing surface OR via toast.
- **Empty state**: dedicated `<Empty>` component (`src/components/ui/empty.tsx`). Icon + message + optional action button. Never an unstyled `"No results."` `<p>`.
- **Skeleton**: gated behind `useDelayedFlag` — see §7.

---

## 19 · Icons, images, animations

- **Icons**: Lucide React ONLY. Sizing `size={20}` / `size={24}` or `w-6 h-6` Tailwind. In Action-column buttons: `size-3.5`. No mixing icon libs.
- **Images**: SVG inline for logos/illustrations; raster via `public/`. Deploy target (Vercel) handles image optimization at the edge.
- **Hover**: Tailwind `hover:` — `hover:bg-primary/90`, never bespoke CSS.
- **Focus visible**: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` on every interactive.
- **Disabled**: Button `disabled:pointer-events-none disabled:opacity-50`. Input `disabled:opacity-50 disabled:cursor-not-allowed`. `aria-disabled` for semantic.
- **Animation duration**: instant 50ms (popover open), fast 150ms (hover state), base 200ms (default), slow 300ms (sheet/drawer). Pick from the token, not bespoke `200ms` literals.

---

## 20 · Accessibility

- Semantic HTML — `<header>`, `<nav>`, `<main>`, `<aside>`, `<button>`, `<a>`. Don't reach for `<div onClick>`.
- `aria-label` on icon-only buttons.
- `aria-invalid` on form inputs with errors (also a styling hook).
- `aria-describedby` linking error message to input.
- Focus rings: never `outline: none` without an alternative ring.
- Focus trap: Base UI dialogs handle automatically.
- Keyboard: every interaction reachable without mouse (handled by `<Link>` / `<button>` / Base UI primitives).
- Color contrast: Tailwind tokens already meet WCAG AA at default opacities. Verify when dipping into `/60` `/40` opacity layers.

---

## 21 · Lint + format

- **oxlint** (replaces ESLint) — config in `.oxlintrc.json`. Plugins: typescript, unicorn, oxc. Categories: `correctness = error`.
- **oxfmt** (replaces Prettier) — config in `.oxfmtrc.json`. Settings: `useTabs: true`, `tabWidth: 2`, `printWidth: 80`, double quotes everywhere, `trailingComma: "all"`, `semi: false`, `arrowParens: "always"`. Ignores: `src/routeTree.gen.ts`, `src/styles.css`.

### Required commands

| Command | Purpose |
|---|---|
| `task typecheck` (or `tsc --noEmit`) | Type-check |
| `task lint` (`oxlint`) | Lint |
| `task lint:fix` (`oxlint --fix`) | Lint + autofix |
| `task format` (`oxfmt`) | Format |
| `task format:check` (`oxfmt --check`) | Format CI gate |
| `task check` | Lint + format check combined |
| `task test` (`vitest run`) | Tests |

CI gate: `task check && task typecheck && task test` all green. `pnpm-lock.yaml` no-op.

### Generated files — never edit, never format

- `src/routeTree.gen.ts` — TanStack Router output
- `src/generated/sdk/` — gqlkit SDK
- `src/styles.css` is hand-authored but listed in oxfmt ignores because of CSS variable density

Edits get clobbered on next regen. Touch the source (route file, GraphQL schema, theme tokens) instead.

---

## 22 · Performance

- **Code splitting**: automatic per route (TanStack Router). `lazy()` for heavy components inside a route (Excalidraw, Monaco) — but behind `clientOnly()` (§13).
- **React Compiler**: `babel-plugin-react-compiler` is enabled. Don't micro-memoize manually unless profiling proves it's needed.
- **Virtualized lists**: `@tanstack/react-virtual` when row count > ~200.
- **Image optimization**: trust Vercel.
- **Bundle size**: large deps go in `vite.config.ts` `optimizeDeps.include` + SSR `noExternal`.

---

## 23 · Tests

- **Framework**: `vitest` + `@testing-library/react` + `jsdom`.
- **File naming**: `*.test.ts` / `*.test.tsx`, colocated with source.
- **Run**: `pnpm test` → `vitest run` (single pass).
- **Watch**: `pnpm vitest`.
- **Mock the SDK** at the module boundary — don't hit real GraphQL in unit tests.
- **Test interactions**, not implementation details (`fireEvent.click` + `expect(...toBeVisible())`, not poking state).
- Component tests: `@testing-library/react`'s `render` + queries by accessible role.

---

## 24 · Commits + repo hygiene

- Commit messages: present-tense conventional (`feat(scope): add user lookup`).
- **Never** commit AI attribution (`Co-Authored-By: Claude` etc.).
- **Never** commit `.env*` / credentials / `_keys/`.
- Generated files (`routeTree.gen.ts`, `src/generated/sdk/`) ARE committed (so consumers can build without running codegen) — but edits to them are reverted on the next regen, so never hand-edit.
- Branch + PR titles match the conventional commit form of the squash commit.

---

## 25 · AI behavior (taste, enforced)

- Questions about code = answer only. Wait for "do it" / "fix it" / "add it" before editing.
- Don't add features beyond what was asked.
- Don't refactor adjacent code that isn't broken.
- Don't delete comments unless explicitly asked.
- Match existing code style.
- Don't update plans / docs / integrate ideas unless explicitly asked.
- **Brainstorming mode**: when the user is exploring/discovering (no commitment to implement), do NOT create tasks or open runs — even if the turn ends in "create a doc about this." The doc is part of the discussion.
- **"Build all" / "do all the phases"**: a sibling/separate git repo (e.g. `aicoder-cli-web` frontend for an `aicoder-cli-go` backend feature) IS in scope — it's the next directory, not "out of scope." Do not self-limit at a repo boundary.

---

## 26 · Anti-pattern catalog

| Anti-pattern | Why banned | What to do instead |
|---|---|---|
| Inline GraphQL string (template literal `query \`{...}\`` + raw fetch) | Bypasses generated types; rename = silent breakage | gqlkit SDK (§3) |
| `useEffect(() => { fetch(...) }, [])` | No cache, no dedup, no refetch-on-focus | TanStack `useQuery` (§7) |
| `window.alert / .prompt / .confirm` | Unstyleable; blocks JS; dismissed by browser chrome | `<ConfirmDelete>` / Dialog + Input (§10) |
| Raw `<select>` / `<option>` | Native styling diverges; no Base UI parity | `<EnumSelect>` with `*_OPTIONS` (§6) |
| `import { ... } from "@radix-ui/..."` | Project migrated off Radix | `@base-ui/react` via shadcn wrappers (§4) |
| Mixing icon libraries | Visual inconsistency | Lucide React only (§19) |
| CSS modules / styled-components | Tailwind v4 is the only system | Utility classes (§1, §5) |
| `any` type | Hides real type errors | `unknown` + narrow / Zod (§2) |
| Default Tailwind blue primary | "AI slop" admin look | Project teal/emerald primary (§5) |
| Heavy `border-2` borders | Reads as draft, not finished | `.hairline` / `border-border/60` (§5) |
| Rendering data in body font | Numbers don't align in columns | `font-mono tabular-nums` (§5) |
| Skeleton without `useDelayedFlag` | Skeleton flashes on every fast nav | `useDelayedFlag(loading)` gate (§7) |
| Shell component fetches via `.execute()` directly | Multiplies identical queries on mount/StrictMode | Module-level cached `getMe()` + `resetMe()` (§7) |
| Bare `localStorage.getItem(...)` at module scope | Nitro SSR 500s every route | `lsGet(...)` helper (§13) |
| Shared infra imports a feature barrel (`@/features/x`) | Init cycle: barrel → feature → shared → barrel | Deep-import concrete file (§13) |
| New `<Drawer>` for entity quick-view | Bypasses QuickView system's X / maximize / back / resize / stack | Extend `QuickViewContext` union (§10) |
| `<li onClick>` for list rows | No `<a>`, no middle-click, no copy-link | `<Link>` row + overlay `Eye/Pencil` (§11) |
| Click-on-row WITHOUT trailing Actions column | Discoverability bug — users don't know what's clickable | Mandatory per-row `Eye + Pencil` (§11) |
| `<PageHeader>` without outer padding wrapper | Title sticks to viewport edge | `<div className="px-6 pt-6"><PageHeader/></div>` (§12) |
| Viewer with `overflow-auto` but no `h-full` | Content overlays siblings OR clips without scrollbar | Always `h-full w-full overflow-auto` (§12) |
| `className="sm:w-[480px]"` on `<SheetContent>` | Base data-attr classes win; override is no-op | `style={{ width: "480px", maxWidth: "100vw" }}` (§10) |
| Dialog without `max-h-[calc(100dvh-2rem)]` | Long content bleeds off viewport top + bottom | Apply once in `DialogContent` base (§10) |
| `npx tsr generate` after route move | No-op in TanStack Start | `vite dev` / `vite build` (§9) |
| Flat-file route `parent.$id.child.tsx` without `<Outlet/>` on parent | Child never mounts — silent nav failure | Flatten: `parent.$id-something.tsx` (§9) |
| `/workspace/<id>` regex for current project | That path doesn't exist; `projectId` always undefined | `/^\/prj\/([^/]+)/` OR `useParams({ strict: false })` (§9) |
| `window.location.reload()` on workspace switch | Full nuke; loses state | `<WorkspaceScope>` with `key={activeWorkspace}` (§14) |
| `window.addEventListener("keydown", ...)` ad-hoc | Conflicts with provider's capture-phase listener | `useKeyboardShortcut(...)` (§15) |
| Keystroke handler without `stopPropagation()` | Both provider AND legacy listener fire | `preventDefault() + stopPropagation()` (§15) |
| Bind `?` AND `Shift+?` | Same keystroke matches both; race | Pick one; use `F1` / `Cmd+/` for second cheatsheet (§15) |
| `<input>` directly inside `DropdownMenuContent` | Typeahead intercepts every printable key | Wrap in `div` with `stopPropagation` on keydown (§15) |
| `<Button>` chrome at default size in shadcn-baseline projects (`h-9` render) | Looks oversized in dense admin UI; ubgo target is `h-8` everywhere except hero CTAs | Map ubgo "default" → `size="sm"` whenever project's button.tsx ships `default: "h-9 …"` (§29.2 — two mapping tables) |
| Bare `<table>` / `<Table>` + `.map(row => <TR>…</TR>)` on a list page | No sort, no filter, no search, no pagination, no saved views, no column show/hide, no row-action dropdown, no empty/error states, no density toggle — every list page accumulates those eventually; rebuilding per page is wasted work | Use the project's full-featured datagrid (`ServerDataTable` / `DataTable` / equivalent) with `columns` + `filterFields` + `sortOptions` + `rowActions` + `queryFn`. Verify pattern by `grep -rln 'ServerDataTable' src/routes/` (§11) |
| `max-w-[1100px] mx-auto` wrapper on an admin list / table / CRUD / dashboard page | Reads as a bug — sibling pages in the same sidebar shell render at different widths; tables get squeezed when they should stretch | Default `<div className="px-6 py-6">` for every list / table / CRUD / dashboard route. `max-w-[1100px]` is reserved for EntityShell detail pages only. Verify by `grep -nE 'max-w-\[' src/routes/<page>.tsx` returning 0 hits (§29.1) |
| `useSyncExternalStore` returning a fresh array per call | "Maximum update depth exceeded" | Token-keyed snapshot cache (§8) |
| Lazy-importing Excalidraw / Monaco / tldraw | SSR hydration crash → blank page | `clientOnly()` boundary (§13) |
| Editing `src/generated/sdk/` | Clobbered on next `task gqlkit:all` | Change SDL + regen (§3) |
| Editing `src/routeTree.gen.ts` | Auto-regenerated by Vite plugin | Move/rename the route file (§9) |
| Hand-rolled MediaCard inside a new feature | Misses selection mode / DnD / quick-view | `FileGrid + FileCard` (§17) |
| New mention-link entity without updating both `MentionTextarea.KIND_PATH` AND `EntityAnchor` regex | Links 404 silently | Update BOTH (§16) |
| Renaming a mention URL format without legacy matcher in `EntityAnchor` | Old saved bodies break | Match canonical first, fall through to legacy (§16) |

---

## 27 · Pre-PR checklist

Before saying a frontend change is "done":

- [ ] §0 — no inline GraphQL; no `useEffect(fetch)`; no native dialogs; no `<select>`; no Radix
- [ ] §2 — `tsconfig` strict invariants intact; no new `any`
- [ ] §3 — every new query/mutation goes through gqlkit SDK; if backend SDL changed, `task gqlkit:all` ran
- [ ] §4 — new components live in the right layer (`ui/` for primitives, feature folder for compositions); use `cn()`; expose `data-slot`
- [ ] §5 — uses design tokens (no `text-[14px]`, no `bg-[#fff]`); data renders in `font-mono tabular-nums`
- [ ] §6 — every dropdown is `<EnumSelect>` (grep `<select` in diff = 0); destructive uses `<ConfirmDelete>`
- [ ] §7 — server state via `useQuery`; skeletons gated by `useDelayedFlag`; shell fetches cached + reset on mutation
- [ ] §8 — global UI state in TanStack Store with token-keyed snapshot; local UI in `useState`
- [ ] §9 — new routes verified via `vite dev` regen of `routeTree.gen.ts`; no `/workspace/<id>` regex
- [ ] §10 — Dialog still has `max-h-[calc(100dvh-2rem)] overflow-y-auto` on base; Sheet width via `style={{ width }}`; new entity quick-views extend `QuickViewContext`
- [ ] §11 — every new table has a trailing Actions column with `Eye + Pencil`; rows are `<Link>` not `<div onClick>`
- [ ] §12 — `<PageHeader>` wrapped in `px-6 pt-6` (or constrained variant); every scrollable viewer is `h-full w-full overflow-auto`
- [ ] §13 — every new `localStorage` read goes through `lsGet`; new feature folders deep-import from shared infra; canvas editors behind `clientOnly()`; always-mounted shell mounted BEFORE `<AuthGate>`
- [ ] §14 — new authenticated gqlkit client uses `authFetch`; no `window.location.reload()` on workspace switch
- [ ] §15 — no new `window.addEventListener("keydown", ...)`; new bindings call `preventDefault + stopPropagation`; no `?` + `Shift+?` pair; `<input>` inside DropdownMenu wrapped in `stopPropagation` div
- [ ] §16 — new mention-link kind updates BOTH `MentionTextarea.KIND_PATH` AND `EntityAnchor`
- [ ] §17 — new media grid surface uses `FileGrid + FileCard` (no local card)
- [ ] §18 — loading + error + empty states all covered; toast via `sonner`
- [ ] §19 — Lucide icons only; focus/hover/disabled states use the token classes
- [ ] §20 — semantic HTML; `aria-label` on icon-only buttons; `aria-invalid` on errored inputs
- [ ] §21 — `task check && task typecheck && task test` green; no edits to `src/generated/sdk/` or `routeTree.gen.ts`
- [ ] §22 — heavy deps lazy + behind `clientOnly()`; not over-memoizing (React Compiler handles it)
- [ ] §23 — new logic has a `.test.tsx` covering happy + error paths
- [ ] §24 — commit message conventional + present-tense; no AI attribution; no `.env*`
- [ ] §25 — only did what was asked; no opportunistic adjacent refactors
- [ ] **Project rules read** (`frontend-project.md` for THIS project's specifics on top of the above; `.aicoder/` / `.lore/` rules queried)

---

## 29 · Concrete UI patterns (verbatim taste)

This is the visual rulebook — exact classNames, dimensions, color maps. When in doubt, copy these literally. Drift from them is technical debt.

### 29.1 · Page wrapper

**Default: full-width with subtle padding.** Admin / list / table / dashboard pages all use the same wrapper as every other route in the project — `<div className="px-6 py-6">` — no `max-width`, no `mx-auto`. The content fills the available column inside the sidebar shell, density tables get the room they need, and visual consistency holds across `/products`, `/collections`, `/metafields`, `/attributes`, every new CRUD page.

```tsx
// Default — what every list / table / CRUD / dashboard route uses
<div className="px-6 py-6">
  <PageHeader ... />
  <ServerDataTable<Row, Where> ... />
</div>
```

**Constrained reading-width** (`max-w-[1100px] mx-auto px-3 sm:px-6 py-3 sm:py-5`) is reserved EXCLUSIVELY for EntityShell detail pages — the editorial-style single-entity detail view where wide content harms scannability. Long-form prose + form-heavy detail panes only. NEVER for admin lists, datatables, or settings pages.

**Discovery rule when adding a new page:** before choosing a wrapper, grep a sibling route. If `/products` / `/metafields` / `/collections` use `<div className="px-6 py-6">`, your new admin page uses it too. Mismatched widths within the same admin shell read as a bug — the sidebar nav implies "these pages are siblings," and siblings have the same content frame.

**Verify by:** `grep -nE 'max-w-\[' src/routes/<your-new-page>.tsx` — should return ZERO hits unless the page is an EntityShell detail.

```tsx
// EntityShell detail (rare — single-entity editorial-style view)
<div className="max-w-[1100px] mx-auto px-3 sm:px-6 py-3 sm:py-5">...</div>
```

Don't author a third wrapper variant. Two shapes, clear trigger for each.

### 29.2 · Button system

| Token | className | Use |
|---|---|---|
| `default` | `bg-primary text-primary-foreground` | Primary CTA, save, submit |
| `secondary` | `bg-secondary text-secondary-foreground` | Alt action |
| `outline` | `bg-card text-foreground border-border` | Neutral action with frame |
| `ghost` | `text-foreground/80 hover:bg-muted` | Icon buttons, row actions, toolbars |
| `soft` | `bg-primary/10 text-primary hover:bg-primary/15` | Tinted secondary (sidebar active, chip-style) |
| `destructive` | `bg-destructive text-destructive-foreground` | Delete confirmation |
| `destructive-soft` | `bg-destructive/10 text-destructive` | Tinted delete (less alarming) |
| `link` | `text-primary underline-offset-4 px-0 h-auto` | Inline anchor styled as link |

Sizes — TWO TABLES because shadcn/basecn ship larger defaults than the dense-UI ideal. **Always check your project's `button.tsx`** to know which table applies, then pick the size that lands at the **target height** column.

**Target sizes (the dense-UI ideal):**

```
xs       h-6  px-2    text-xs                  rare; super-compact toolbars
small    h-7  px-2.5  text-[13px]              rare; tightest viable
default  h-8  px-3    text-[13px]   ★ most common in dense admin chrome
medium   h-9  px-3.5  text-sm                  hero CTAs on landing pages
large    h-10 px-4    text-sm                  rare; marketing
icon-sm  size-7 px-0                ★ row-action default
icon     size-8 px-0
icon-lg  size-9 px-0
```

**Mapping into the actual `Button` you import** — two flavors:

| Project ships… | …then ubgo "default" maps to | Verify by |
|---|---|---|
| `default: "h-8 px-3"` (compact) | `size="default"` | `grep "default:" components/ui/button.tsx` shows `h-8` |
| `default: "h-9 px-4"` (shadcn/basecn baseline) | `size="sm"` (because the project's `sm` is `h-8`) | `grep "default:" components/ui/button.tsx` shows `h-9` |

**Rule of thumb that always works:** look at the rendered `<button>` height in DevTools. If it's anything other than `32px` (= `h-8`) for chrome buttons (top-of-page CTAs, table-toolbar buttons, form footer buttons), it's wrong — fix the `size=` prop until it lands at 32px.

**Icon-button mapping** is the same pattern:

| Project ships… | …then ubgo "icon-sm" maps to | Target |
|---|---|---|
| `icon-sm: "size-7"` (dense) | `size="icon-sm"` | size-7 (28px) |
| `icon-sm: "size-8"` (shadcn baseline) | `size="icon-sm"` (project's icon-sm = size-8 = the row-action target in that project) | size-8 (32px) |
| no `icon-sm` defined | add it; or use `size="icon"` if that lands at 28–32px | — |

**Rules (regardless of which mapping applies):**

- **Icon-text gap: always `gap-1.5`.**
- SVG inside button defaults to `size-3.5` unless overridden.
- Active press: `active:translate-y-px` (1px down — already baked into base).
- Disabled: `disabled:opacity-50 disabled:pointer-events-none` (baked).
- Loading: `disabled={isSubmitting}` + change label to `"Creating…"` (ellipsis char `…`, not three dots). Never spin a spinner without also disabling.
- In dialogs: ALWAYS use the size that lands at `h-8` on footer buttons. In shadcn-baseline projects that's `size="sm"`. In compact-default projects that's `size="default"`. Never let a footer button render at `h-9`+ — looks oversized.
- Top-of-page CTAs (the "New X" button in PageHeader's right slot) follow the same rule: render at `h-8`. Same size mapping applies.

**Mismatch audit checklist** (run when you join a new project):

1. `grep -E "default:|sm:|icon-sm:" src/components/ui/button.tsx` to see what the project's variants emit
2. Compare against the target column above
3. If shipped `default = h-9`, add a one-line note to `frontend-project.md` overlay: *"In this project, ubgo's prescribed `size='default'` maps to `size='sm'`. Use `size='sm'` for all chrome buttons; reserve `size='default'` for hero CTAs."*
4. If shipped `default = h-8`, no overlay needed — sizes line up.

### 29.3 · Inputs

```
h-8 px-2.5 py-1 rounded-lg border border-input bg-transparent
placeholder:text-muted-foreground/70
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
aria-invalid:border-destructive aria-invalid:ring-destructive/20
text-[13px]
```

Textarea: same base, plus `field-sizing-content min-h-16 rows={5}` (default) or `rows={2}` (compact).

### 29.4 · Form layout

```tsx
<form className="space-y-3">
  <div>
    <label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-mono mb-1 block">
      Title
    </label>
    <Input ... />
  </div>
  ...
</form>
```

- **Field spacing: `space-y-3`.** Not `space-y-4`. Dense UI.
- **Label: `text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-mono mb-1 block`.** Verbatim. Every form. No asterisk for required — disable the submit button when validation fails (`disabled={!canSubmit}`).
- Two-column form rows (label on left): `grid grid-cols-[140px_minmax(0,1fr)] gap-2`. Use only when labels are short + glanceable; default to label-on-top.
- Help text under input: `text-[11px] text-muted-foreground mt-1`.
- Error text under input: `text-[11px] text-destructive mt-1`.

Dialog footer button row:

```tsx
<DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
  <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
  <Button size="sm" disabled={!canSubmit || isSubmitting} onClick={() => form.handleSubmit()}>
    {isSubmitting ? "Saving…" : "Save"}
  </Button>
</DialogFooter>
```

Cancel left, Save right (on desktop). Mobile reverses (`flex-col-reverse`) — Save floats to top of footer where the thumb lives.

### 29.5 · Dialog

```
max-w-[calc(100%-2rem)] sm:max-w-[540px]
max-h-[calc(100dvh-2rem)] overflow-y-auto
p-4 gap-4 rounded-xl ring-1 ring-foreground/10
bg-popover text-popover-foreground
```

Dialog widths by content:

- Confirmation / small form: `sm:max-w-sm` (24rem / 384px) — base default
- Standard create/edit: `sm:max-w-[540px]`
- Wide edit with side metadata: `sm:max-w-[600px]`
- Long-form (markdown editor inside): `sm:max-w-[720px]` MAX. Beyond that, route to a full page.

Title: `font-heading text-base leading-none font-medium`. Description: `text-sm text-muted-foreground`.

Footer (when present) extends to dialog edges via negative margins: `-mx-4 -mb-4 px-4 py-3 border-t bg-muted/50 rounded-b-xl`.

### 29.6 · Card

```
rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden
py-4 px-4 gap-4               (default)
py-3 px-3 gap-3               (size="sm")
```

Use `ring-1 ring-foreground/10` instead of `border`. Hairline taste — subtle outline, not chunky frame.

Subcomponents:

- `CardHeader`: `px-4 gap-1 rounded-t-xl` — title row + optional action
- `CardContent`: `px-4` — body
- `CardFooter`: `p-4 rounded-b-xl border-t bg-muted/50` — actions, meta

Use a card when: standalone panel with distinct hierarchy, grouped settings, dashboard tile. Use a bare `<section>` with hairline `<hr className="border-border/60">` separators when: list of sections on one page (avoid card-soup).

### 29.7 · Table / ServerDataTable

**Header row:**

```
bg-surface-1 sticky top-0 border-b border-border
font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground
px-3 py-2
```

**Data row (default density):** `h-9 py-1.5 text-[13px] px-3 border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors`
**Data row (compact density):** `h-7 py-1 text-[13px]` (same rest)
**Selected row:** `bg-primary/5`
**Checkbox column:** `w-9 px-3 py-2`
**Actions column (icon cluster):** `w-30 text-right pr-2`
**Actions column (single dropdown):** `w-11 text-right`

Column definition shape:

```ts
type DataTableColumn<T> = {
  id: string
  header: string
  size: number                  // px width
  cell: (row: T) => ReactNode
  meta?: { className?: string }
}
```

Sort: icon-only header click. Active indicator `<ArrowUp size-3>` / `<ArrowDown size-3>`. No dropdown.

Pagination: cursor-based (`<CursorPaginationBar>`), NOT page-numbered. Page size selector: `[10, 20, 50, 100]`. Located below table, centered.

Row title cell — two-line pattern:

```tsx
<Link to={...} className="block">
  <div className="truncate font-medium">{row.title}</div>
  {row.summary && (
    <div className="truncate text-[11px] text-muted-foreground">{row.summary}</div>
  )}
</Link>
```

Per-row Actions column (mandatory, see §11):

```tsx
<Button variant="ghost" size="icon" className="size-7" onClick={(e) => { e.stopPropagation(); qv.push({ kind, id: row.id }) }}>
  <Eye className="size-3.5" />
</Button>
<Button variant="ghost" size="icon" className="size-7" onClick={(e) => { e.stopPropagation(); openEdit(row.id) }}>
  <Pencil className="size-3.5" />
</Button>
```

### 29.8 · Bulk action bar

When selection mode is on, show a floating action bar:

```
sticky bottom-4 z-30 mx-auto w-fit
rounded-full border border-border bg-card/90 backdrop-blur-md shadow-lg
px-2 py-1.5
animate-in fade-in slide-in-from-bottom-2 duration-200
```

Counter badge: `h-5 min-w-5 px-1 rounded bg-primary text-primary-foreground text-[10px] font-semibold tabular-nums`. Format: `"{count} selected"` or `"{count} of {total} selected"`. Vertical dividers between groups: `h-4 w-px bg-border`. Clear button: `<X>` icon, `size="icon-xs"`, `variant="ghost"`.

### 29.9 · Search input

```tsx
<div className="h-8 flex items-center border border-border rounded-md bg-card text-[13px]
                focus-within:border-border-strong focus-within:ring-2 focus-within:ring-ring/30">
  <Search className="size-3.5 ml-2.5 text-muted-foreground shrink-0" />
  <input className="flex-1 bg-transparent px-2 py-1.5 placeholder:text-muted-foreground/70
                    [&::-webkit-search-cancel-button]:hidden" />
  {/* When empty: */}
  <kbd className="mr-1.5 h-5 px-1.5 border border-border bg-muted rounded text-[10px] font-mono text-muted-foreground">⌘K</kbd>
  {/* When text present: */}
  <button className="mr-1 size-5 grid place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
    <X className="size-3" />
  </button>
</div>
```

### 29.10 · Sidebar

Dimensions: expanded `w-[220px]`, collapsed `w-[52px]`, transition `transition-all duration-200`. Border: `border-r border-sidebar-border`. Background: `bg-sidebar`.

Brand area: `h-12 px-3 border-b border-sidebar-border gap-2.5`. Brand badge: `w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60`.

**Nav row (inactive — memorize):**

```
flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px]
text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent
transition-all
```

**Nav row (active — adds two classes):**

```
font-medium text-primary bg-primary/10 hover:bg-primary/15
```

Icon size in nav: `size-4` (16px). Keyboard shortcut hint badge (hidden until row hover): `hidden group-hover:inline-flex h-[18px] min-w-[18px] px-1 rounded bg-sidebar-border/60 text-[10px] font-mono text-sidebar-foreground/30`.

Section labels: `text-[9.5px] uppercase tracking-[0.16em]` with `px-2.5 mb-1`. Dividers between groups: `mt-3 pt-3 border-t border-sidebar-border`. Item-to-item gap inside a group: `space-y-0.5` (very tight).

### 29.11 · EntityShell (detail page)

Container: `max-w-[1100px] mx-auto px-3 sm:px-6 py-3 sm:py-5`.
Grid: `grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4 sm:gap-6`. Right sidebar fixed `240px`.

**Top bar** (`gap-1 sm:gap-2 mb-2 sm:mb-3`):

- Back button: `h-7 px-2 rounded text-[12px] inline-flex items-center gap-1 hover:bg-muted text-muted-foreground`
- Actions cluster (right): `ml-auto flex items-center gap-1 flex-wrap justify-end`

**Kicker** (above title): `text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5`.
**Title**: `text-[22px] font-semibold leading-tight tracking-tight mb-2`.
**Chips row** (under title): `flex items-center flex-wrap gap-1.5 mb-4`.
**Body**: `space-y-5`.
**Rails** (related-entity strips under body): `mt-7 space-y-5`.
**Sidebar**: `lg:sticky lg:top-5 self-start space-y-4`.

### 29.12 · Chips, StatusPill, MetaRow

**Chip / StatusPill** (shared shape):

```
text-[10px] uppercase tracking-[0.1em] font-medium
px-1.5 py-0.5 rounded
```

Status → color map (use these EXACT pairings — they're the canonical semantic mapping):

| Status | className |
|---|---|
| `draft` / `cancelled` / muted | `bg-muted text-muted-foreground` |
| `active` / info | `bg-blue-500/10 text-blue-600` |
| `doing` / in-progress | `bg-sky-500/10 text-sky-600` |
| `review` / pending | `bg-amber-500/10 text-amber-700` |
| `blocked` / error | `bg-rose-500/10 text-rose-700` |
| `done` / success | `bg-emerald-500/10 text-emerald-700` |
| `open` / warning | `bg-amber-500/10 text-amber-700` |

Don't reach for raw `bg-green-500` / `bg-red-500`. Use the `/10` background + `-700` (light theme) text pairing — that's the taste signature.

**MetaRow** (label + value pair in sidebars):

```
flex items-baseline gap-3 text-[12px]
label: text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70 min-w-[72px]
value: text-foreground/90 truncate
```

**SidebarSection** (grouped sidebar block):

```
space-y-1.5
title: text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium
```

### 29.13 · Quick view drawer

- Right-side Sheet, default width 1040px, min 480px, persisted to `localStorage["aicoder.quickview.width"]`.
- Stack support: multiple quick views layer, each prior one peeks 56px to the left (`PEEK_OFFSET = 56`).
- Header: close `<X>` top-right `size-icon-sm`, back button left of close, maximize button → `goFullPage()` → `queueMicrotask(() => navigate(...))` so the drawer closes cleanly before nav.
- Kind label in header: matches `KIND_LABEL["task" | "spec" | ...]`.
- Resize handle: left edge, cursor `ew-resize` during drag.

Width override (CRITICAL — see §10): `style={{ width: storedWidth, maxWidth: "100vw" }}`. NOT `className="sm:w-[...]`. Data-attr classes baked into shadcn `SheetContent` win otherwise.

### 29.14 · Empty state

```tsx
<Empty className="p-6 md:p-12 border-dashed gap-6 text-center text-balance flex flex-col items-center justify-center">
  <EmptyMedia variant="icon" className="size-10 bg-muted rounded-lg text-foreground">
    <Inbox className="size-6" />
  </EmptyMedia>
  <EmptyTitle className="text-lg font-medium tracking-tight">No memories yet</EmptyTitle>
  <EmptyDescription className="text-sm/relaxed text-muted-foreground">
    Capture a memory to remember a decision, a pattern, or a gotcha for next time.
  </EmptyDescription>
  <EmptyContent className="max-w-sm gap-4">
    <Button size="sm">Create memory</Button>
  </EmptyContent>
</Empty>
```

Never an unstyled `"No results."` `<p>`. Empty states are a feature, not a fallback.

### 29.15 · Skeleton

```tsx
// Row skeleton
<Skeleton className="h-9" />
// Card skeleton
<Skeleton className="h-24" />
// Text-line skeleton
<Skeleton className="h-4 w-1/2" />
// Grid of cards
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
</div>
```

Skeleton base: `animate-pulse rounded-md bg-muted`. **Always gate behind `useDelayedFlag(loading, 150)`** (§7). Skeleton without the delay = flash on every fast nav.

### 29.16 · Toast (sonner)

Position: bottom-right (`bottom-4 right-4`). Stack: max 5 visible, older drop. Default duration: `2400ms`.

Variants:

```
success → bg-emerald-500/10 text-emerald-700 border-emerald-500/30  + <Check size-3.5>
error   → bg-rose-500/10 text-rose-700 border-rose-500/30           + <X size-3.5>
info    → bg-card text-foreground border-border                     (no icon)
```

Toast item shape: `flex items-center gap-2 px-3 py-2 rounded-md border text-[12.5px] shadow-md animate-in slide-in-from-bottom-2`. Pointer events: `pointer-events-auto`. Container around the stack: `pointer-events-none` so it doesn't block underlying UI.

### 29.17 · Tabs

Two variants — pick per surface:

**Pill variant** (default — settings, content switching):

```
List: h-8 bg-muted rounded-lg p-[3px] inline-flex items-center justify-center
Trigger: px-1.5 py-0.5 text-sm font-medium text-foreground/60
  hover: hover:text-foreground
  active: data-active:bg-background data-active:text-foreground shadow-sm
```

**Line variant** (page-level navigation):

```
List: gap-1 bg-transparent rounded-none
Trigger: same base + after-pseudo underline bar
  after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-foreground after:opacity-0
  active: data-active:after:opacity-100
```

Focus ring on triggers: `focus-visible:ring-[3px] focus-visible:ring-ring/50`.

### 29.18 · Kanban

Board: `grid gap-3 overflow-x-auto pb-2`. Columns: `grid-cols-[repeat(N,minmax(240px,1fr))]` (240px min per column).

Column header icon colors (status board):

```
todo      → text-muted-foreground
doing     → text-sky-600 dark:text-sky-400
review    → text-amber-600 dark:text-amber-400
blocked   → text-rose-600 dark:text-rose-400
done      → text-emerald-600 dark:text-emerald-400
cancelled → text-muted-foreground/60
```

Add-card affordance: `<Plus>` icon ghost button at column bottom.

### 29.19 · Cmdk command palette

Trigger: `Cmd+K` / `Ctrl+K` → keyboard event `palette:command:open` (see §15). Search input autofocuses on open. Query debounce: 150ms.

Result items grouped by entity Kind (Task, Spec, Plan, Decision, Memory). Each Kind has icon + label. Item layout: icon (left) + title + subtitle (center) + chip (right, optional) at `text-[13px]`.

Explicit create prefix: query starting with `+` or `>` triggers a "Create {kind} from this" action. Implicit fallback: when no results match, suggest creating the matched-kind entity.

### 29.20 · Pagination component

Container: `flex justify-center w-full`. Item gap: `gap-0.5`.

- Number links: `size="icon"` (size-8 square), variant `ghost` (inactive) / `outline` (active).
- Previous/Next: `size="default"` (h-8), icon-with-text via `data-icon="inline-start"` / `"inline-end"`, label `hidden sm:block`.
- Ellipsis: `flex size-8 items-center justify-center` + `<MoreHorizontalIcon>`.

### 29.21 · Markdown / Streamdown

- Prose runs in Geist (body font).
- Code blocks: Geist Mono inside `bg-muted` (or whatever Streamdown's theme emits — don't override per-page).
- Math via KaTeX (`@import "katex/dist/katex.min.css"` in `styles.css`).
- Mermaid + CJK supported via Streamdown plugins.
- Inline links in markdown bodies: underline + `underline-offset-3` + hover-to-foreground. Don't restyle per-page.

### 29.22 · Date / time / number formatting

- **Numbers, counts, sizes, durations, percentages, IDs**: `font-mono tabular-nums` always. So `42` and `42,318` line up in a column.
- **Timestamps** in detail pages: absolute (e.g. `May 15, 2026 · 14:32`), in `font-mono text-[11px] text-muted-foreground tabular-nums`.
- **Timestamps** in list rows: relative (`2h ago`, `yesterday`, `3d ago`), same mono/tabular treatment, fall back to absolute on hover via `title` attribute.
- **Currency / amounts**: mono + tabular + right-aligned in tables.

### 29.23 · Common Tailwind patterns (cheatsheet)

| Pattern | className |
|---|---|
| Page wrapper (constrained) | `max-w-[1100px] mx-auto px-3 sm:px-6 py-3 sm:py-5` |
| Page wrapper (full) | `px-6 pt-6` |
| Section header (rail label) | `text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono` |
| Form label | `text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-mono mb-1 block` |
| Help text | `text-[11px] text-muted-foreground mt-1` |
| Error text | `text-[11px] text-destructive mt-1` |
| Divider | `border-t border-border/60` OR `h-px bg-border/60` |
| Hairline (subtle) | `border-border/60` everywhere over `border-border` |
| Form field gap | `space-y-3` |
| Card body sections | `space-y-4` |
| Page sections | `space-y-5` |
| Icon-text gap | `gap-1.5` |
| Sidebar nav item gap | `gap-2.5` |
| Hover (row, subtle) | `hover:bg-muted/40` |
| Hover (button, stronger) | `hover:bg-muted` |
| Truncate single line | `truncate` |
| Truncate two lines | `line-clamp-2` |
| Sticky table header | `sticky top-0` |
| Sticky page sidebar | `lg:sticky lg:top-5 self-start` |
| Focus ring (interactive) | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` |

### 29.24 · Color usage (when to reach for which)

- `bg-primary` (solid teal/emerald): the ONE primary CTA per surface. Save, Submit, Confirm. Never two on one screen.
- `bg-primary/10 text-primary` (soft): sidebar active row, active tab, "soft" button variant, selection highlights.
- `bg-primary/5`: selected table row.
- `bg-secondary`: rare — alternative action that pairs with primary. Usually skip in favor of `outline`.
- `bg-card`: input + card surface (sits on `bg-background`).
- `bg-popover`: dropdown / popover surface (slightly elevated card).
- `bg-muted`: disabled input, skeleton, faded chip background, footer band.
- `bg-muted/50`: dialog/card footer band.
- `bg-destructive`: ONLY confirmed-destructive buttons (delete with confirmation behind).
- `bg-destructive/10 text-destructive`: soft delete chip, error toast tint, validation error background (rare).
- `bg-accent` (amber-signal): sparingly — call-outs, "new" badges. Never as primary CTA.
- Hardcoded `bg-blue-*` / `bg-green-*` / `bg-red-*`: ONLY inside the status-color map (§29.12). Never freehand.

### 29.25 · Text colors (foreground opacity ramp)

```
text-foreground         primary text, table cells, body copy
text-foreground/90      slightly de-emphasized (meta values)
text-foreground/80      ghost button text
text-foreground/60      tab inactive, secondary text
text-muted-foreground   labels, hints, timestamps, captions
text-muted-foreground/70  deep-muted (sidebar version label, kicker)
text-muted-foreground/40  very subtle (collapse toggle idle)
```

Don't invent intermediate opacities. The ramp above is the entire vocabulary.

### 29.26 · Density (the project IS dense — don't fight it)

This is a dense, information-rich UI — `text-[13px]` body, `h-8` controls, `space-y-3` form fields, `px-3 py-1.5` table cells. If a screen looks crowded to a fresh eye, the answer is almost never "make it bigger" — it's "improve hierarchy via type weight + color ramp + hairline separators." Pushing to airy `text-base + p-6` everywhere makes the whole product feel slower because there's less on each screen.

### 29.27 · The ship-gate (one more time, applied to UI work)

Before pushing visual changes, walk these five gates:

1. **No default Tailwind blue.** Primary is the project's teal/emerald token. If you see a blue button you didn't put there, something's wrong with the theme load.
2. **No generic rounded-card-with-Inter dashboard.** Fonts are Fraunces + Geist + Geist Mono. Numbers are tabular. Borders are hairline. If it looks like a Stripe Dashboard clone, you've reverted to AI-default taste.
3. **No data in body font.** Numbers, IDs, timestamps, versions → mono + tabular-nums. Always.
4. **Hairline rules.** `border-border/60` or `.hairline`. Not `border-2`.
5. **One conceptual direction.** Editorial / brutalist / terminal / dense-data — commit to one. "Modern SaaS" is not a direction; it's the absence of one.

---

## 30 · When in doubt

- ANSWER first if the user described a situation rather than gave an imperative. Wait for go-ahead before editing.
- Never `git commit` / `git push` without asking.
- A single imperative verb ("add X", "fix Y") = go-ahead. An interrogative / "should we…?" = discussion.
- If the project uses a knowledge-base CLI (`aicodermini`, `lore`, similar), query its rules + hotfixes BEFORE substantive replies.
- If you find yourself rewriting > 5 files without confirming the approach, STOP and check in.
- Brainstorming ≠ implementing. Don't open tasks/runs for exploration.
