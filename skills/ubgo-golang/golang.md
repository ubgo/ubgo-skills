# Go Backend Rules — generic (drop-in)

**Read before:** ANY change to Go code. These rules are project-agnostic — they describe the stack + taste we use across every Go project. Project-specific overrides (named constants, codegen task names, DB-name gotchas, workflow) live in a sibling `golang-project.md`; read both before substantive backend work.

> Authoring note: plain markdown rendered by GitHub + filemark. Keep prose on single physical lines (no hard-wrap). Tables, fenced code, and frontmatter are the only line-break exceptions.

---

## 0 · The 3 commandments

1. **NO bare strings for any value with a closed set of choices.** Status, kind, sort key, role, scope, source — every one of those gets a typed constant in a `constants.go` file beside the package that owns the field. A typo becomes a compile error; a rename is one place. See §2.
2. **NO hardcoded enum lists in the data layer.** `field.Enum(...)` baked into ent schemas locks user-facing taxonomy into the schema; growing the set requires a migration and it can't be tenant-scoped. Use reference tables instead. See §4.
3. **NO business validation at the DB level.** No triggers, no CHECK constraints beyond what the ORM emits structurally, no hardening SQL. The DB is dumb storage; validation + integrity live in the app layer. Future sharding compatibility is the load-bearing reason. See §6.

If you find yourself violating one of those three, stop and ask before continuing.

---

## 1 · Stack (consistent across every Go project we ship)

We use the same libraries everywhere. If you're tempted to introduce an alternative, the answer is almost always no — extend the wrapper, don't bypass it.

| Concern | Library | Notes |
|---|---|---|
| HTTP server | `gin` (wrapped via `lace/ginserver`) | |
| GraphQL | `gqlgen` | code-first, type-safe; resolvers hand-written and one-line-delegated |
| ORM | `ent` + `entpoly` (polymorphic) | `entpoly` REQUIRED for any polymorphic-owner relation (§5) |
| CLI | `cobra` (wrapped via `lace/cli`) | |
| Config | PKL (Apple) | type-safe, codegen; secrets via `read("env:VAR")` |
| Validation | `valgo` (`github.com/cohesivestack/valgo`) | for business rules; ent's `.NotEmpty()` / `.MaxLen()` handle structural |
| Logging | `lace/gozap` | wraps zap with OTEL hooks; `gozap.FromCtx(ctx)` propagates trace IDs |
| Tracing | `lace/gotel` | OTEL setup; `telem.TraceStart(ctx, "name")` helper |
| Postgres driver | `pgx/v5` (wrapped via `lace/db`) | |
| Cache | `lace/cache` + `lace/cacheredis` | interface + Redis impl |
| Messaging | `lace/natso` | NATS JetStream wrapper |
| Scheduler | `gocron/v2` (transitioning to **Hatchet**) | new work targets Hatchet |
| HTTP client | `lace/httpreq` | timeouts + retries handled |
| IDs | `lace/publicid` | prefixed IDs (`prd_`, `prj_`, …); never roll your own |
| Encryption | `lace/crypt` | AES; CLI for encrypt/decrypt |
| Errors | stdlib `errors` + `fmt.Errorf("...: %w")` | optional `goerr` wrapper for richer types |

**`lace/` wrappers MUST be used over the underlying library directly.** That's where project conventions (logger injection, telemetry, prefix policy, retry, sentry hooks) are wired. Need something the wrapper doesn't expose? Extend the wrapper; don't bypass it. Direct use of `nats.go` / `go-redis` / raw `pgx` is an automatic NACK in review.

**Do not use:**

- `encoding/json` raw for validation — use `valgo`
- `database/sql` directly — use `ent`
- stdlib `log` — use `lace/gozap`
- `net/http` server directly — use `gin` (via `lace/ginserver`)
- Custom cron scheduling — use `gocron/v2` (or Hatchet on new code)
- `math/rand` for tokens / IDs / nonces — use `crypto/rand` (§24)

---

## 2 · Typed constants over string literals

**Where every constant lives:** per-package `constants.go` file at the package root. Group constants by entity (status, kind, sort key, …) and include a top-of-file comment explaining the rule.

```go
// pkg/foo/constants.go
package foo

// Rule: NO BARE STRINGS for any value with a closed set of choices. Every
// switch / case / map literal here referencing one of these picks from the
// constants below. Typo = compile error; rename = one place.

const (
    StatusActive   = "active"
    StatusDraft    = "draft"
    StatusArchived = "archived"
)

// StatusValues is the canonical iteration order — drives seed data, UI tabs,
// and any histogram. Reading and writing share this same source.
var StatusValues = []string{StatusActive, StatusDraft, StatusArchived}
```

**Checklist — does this value need a constant?**

- [ ] Appears in 2+ switch cases or map keys → YES.
- [ ] Compared with `==` against a string literal anywhere → YES.
- [ ] Lives in a closed enumeration the API consumer must match → YES, with a `*Values` slice for iteration.
- [ ] Appears in seed data, fixtures, AND production code → YES, the seed and the runtime MUST share the same constant.
- [ ] Free-form user text (search query, title, description) → NO, keep as string.

**Anti-pattern (don't do):**

```go
case "title":  ...
case "price": ...
hist := map[string]int{"active": 0, "draft": 0}
return "shopify"
```

**Pattern (do):**

```go
case SortKeyTitle:  ...
case SortKeyPrice:  ...
for _, st := range StatusValues { hist[st] = 0 }
return SourceSystemShopify
```

**Wire-format fixtures stay as-is.** When the constant exists because an UPSTREAM system (Shopify, Stripe, …) gave it to us, the fixture JSON in `testdata/` keeps the upstream field name verbatim — your code translates INTO our typed constant, never the reverse.

---

## 3 · Polymorphic relations — entpoly, always

Every polymorphic owner relation (a table with `owner_type` + `owner_id` discriminator pair) uses `github.com/khanakia/entx/entpoly`. Hand-rolled `owner_kind` enum columns are BANNED.

```go
// schema/<table>.go
func (Foo) Mixin() []ent.Mixin {
    return []ent.Mixin{
        BaseMixin{Prefix: "foo"},
        TenantMixin{},
        entpoly.MorphMixin("owner",
            entpoly.MixinAllowed(Product.Type, ProductModel.Type, Collection.Type),
            // Namespaced because Postgres index names are schema-global and
            // multiple ent modules often share the same DB.
            entpoly.MixinIndexName("<module>_foo_owner_morph_idx"),
        ),
    }
}

func (Foo) Edges() []ent.Edge {
    return []ent.Edge{
        entpoly.MorphTo("owner", Product.Type, ProductModel.Type, Collection.Type),
    }
}

func (Foo) Indexes() []ent.Index {
    return []ent.Index{
        index.Fields("foo_scope", "owner_type", "owner_id", ...).
            StorageKey("<module>_foo_<scope>_owner_<...>_idx").Unique(),
    }
}
```

**Required, no exceptions:**

- `MixinAllowed(...)` — promotes `owner_type` to a typed enum + DB constraint. Skipping it makes the discriminator a plain string with only Go-side safety.
- `MixinIndexName("<module>_<table>_owner_morph_idx")` — namespaced. The default collides across modules sharing the same DB.
- Unique indexes that include the discriminator pair use the entpoly column names (`owner_type`, NOT `owner_kind`). Storage key MUST be module-namespaced too.

**Read path** — typed predicates, no raw strings:

```go
import "module/gen/ent"

foo.OwnerTypeEQ(foo.OwnerType(string(ent.CollectionMorphKey)))
foo.OwnerID(id)
```

Project-level convention: pre-compute the morph-key strings ONCE as package-level vars sourced from entpoly's emitted `*MorphKey` constants — never author them as string literals:

```go
var (
    ownerKindProduct      = string(ent.ProductMorphKey)
    ownerKindProductModel = string(ent.ProductModelMorphKey)
    ownerKindCollection   = string(ent.CollectionMorphKey)
)
```

**Write path:**

```go
// Preferred — typed parent (compile-time check on AllowedTypes):
c.Foo.Create().SetOwner(parentEnt).Save(ctx)

// Split set when you already have id+key:
c.Foo.Create().SetOwnerType(foo.OwnerType(ownerKindCollection)).SetOwnerID(id).Save(ctx)
```

**Why entity subtypes (e.g. variants) don't get their own morph key.** entpoly maps to ent TYPES. If "variant" and "product" share one ent.Schema (variants are rows with `parent_id != null`), they land under the SAME `owner_type` value. Distinguish via JOIN to the parent column, never invent a fake morph key the schema doesn't support.

**Migration from a hand-rolled `owner_kind` column** (pre-flight SQL, backup DB first):

```sql
BEGIN;
DROP INDEX IF EXISTS <old_unique_idx_with_owner_kind>;
UPDATE <table> SET owner_type = owner_kind WHERE owner_type IS NULL;
ALTER TABLE <table> DROP COLUMN owner_kind;
COMMIT;
```

Then rewrite the schema → regen ent → run migrate → sweep read paths (`OwnerKindEQ(OwnerKind(x))` → `OwnerTypeEQ(OwnerType(x))`, `SetOwnerKind` → `SetOwnerType`, `m.OwnerID` is now `*string` so wrap reads in `derefStr(...)`).

---

## 4 · Reference tables, not `field.Enum`

**Rule:** any user-facing closed enumeration of "kinds-of-things" the schema models lives in a reference table, not a hardcoded `field.Enum`. Examples: product status, product kind, attribute input type, collection type, association kind, bundle type, price type, supplier type.

**Reference-table shape** (canonical):

```go
type ProductStatus struct{ ent.Schema }

func (ProductStatus) Mixin() []ent.Mixin {
    // RefTableMixin gives (id, team_id NULL=global / set=tenant, shop_id,
    // code, label, attributes jsonb, active, created/updated). Use it.
    return []ent.Mixin{BaseMixin{Prefix: "ps"}, RefTableMixin{}}
}

func (ProductStatus) Fields() []ent.Field {
    // Behavior columns / per-channel native_type hints specific to THIS
    // ref table go here. Stay minimal; generic stuff is in RefTableMixin.
    return []ent.Field{}
}

func (ProductStatus) Indexes() []ent.Index {
    return []ent.Index{
        // Code unique per scope (team_id NULL = global; team_id set = tenant override).
        index.Fields("team_id", "shop_id", "code").Unique(),
    }
}

func (ProductStatus) Annotations() []schema.Annotation {
    return []schema.Annotation{entsql.Annotation{Table: "<module>_product_status"}}
}
```

**App-layer validation** before insert / update:

```go
ok, err := s.refTableHasCode(ctx, tenant, "product_status", in.StatusCode)
if !ok { return fmt.Errorf("validate: unknown status %q", in.StatusCode) }
```

**Seed the global rows** using the typed constants from §2 — NEVER seed with bare strings. The seed pair pattern `{ProductStatusActive, "Active"}` keeps code + label colocated and rename-safe.

**The ONLY allowed `field.Enum`:** the one entpoly's `MorphMixin + MixinAllowed` emits internally for `owner_type`. That's tightly coupled to the extension's correctness, not user-facing taxonomy.

**Why this matters:**

- Adding a new value to a `field.Enum` requires a migration. Adding a row to a reference table is a `task seed` or one INSERT.
- `field.Enum` is global to the schema. A reference table can have tenant-scoped overrides (`team_id NULL = global / team_id set = tenant-specific`).
- Per-channel behavior hints (e.g. "this status maps to Shopify's `ARCHIVED`") fit naturally as columns on the reference row; they have nowhere to live on a `field.Enum`.

---

## 5 · DB as dumb storage

**Rule:** ALL validation + integrity + hardening lives in the APP LAYER. The DB exists to store rows, period. Future sharding compatibility is the load-bearing reason — DB-level hardening becomes a headache when sharding.

**Do NOT add:**

- Triggers (BEFORE / AFTER INSERT / UPDATE) — `trg_*`, `*_check`, polymorphic-owner existence triggers, completeness recomputation triggers, cache-refresh triggers
- CHECK constraints beyond what the ORM emits structurally
- `NULLS NOT DISTINCT` hardening on uniques
- Polymorphic FK enforcement at the DB level
- Variant-axis canonicality triggers, business-invariant triggers
- Any hand-rolled `*-hardening.sql` or sibling DDL beyond what the migrate task produces

**Acceptable** (rides along free):

- PK + unique index constraints ent emits structurally
- `field.Enum` validators ent generates for entpoly `MixinAllowed` (Go-side validator + DB enum)
- ent migrate with `WithForeignKeys(false)` — the project default

**If you find existing hardening SQL** in the repo: treat it as design history only. The running modules use `Schema.Create + WithForeignKeys(false)` exclusively; old `*-hardening.sql` files are NOT applied.

**Where the validation lives instead:**

- Service entry point: `valgo` blocks (§13)
- Resolver / handler: authorization + request-shape checks
- Ent schema: structural constraints only (`.NotEmpty()`, `.MaxLen()`, `.Unique()`)

---

## 6 · Errors

**Always wrap with operation context** using `%w`:

```go
// Good
return nil, fmt.Errorf("getUser %s: %w", id, err)

// Bad — caller is blind
return nil, err

// Bad — double logging (log once, at the boundary; see §10)
log.Error("get user", err)
return nil, err
```

**Sentinel errors** for expected conditions:

```go
var ErrNotFound = errors.New("svc: not found")

// Caller:
if errors.Is(err, svc.ErrNotFound) { ... }
```

Custom error types ONLY when the caller needs structured access (field, code) — unwrap via `errors.As`.

**Error as last return value:**

```go
// Good
func demo() (bool, error)
func demo() (*User, error)

// Bad
func demo() (error, bool)
func demo() (bool, error, int)
```

**Never silently ignore errors.** Check every `error` return. `_ = …` is acceptable only for documented optional-cleanup paths (with a comment).

---

## 7 · Context

Any call that can block (HTTP, DB, RPC, file I/O, channel send, sleep) accepts `context.Context` as the **first** argument and respects its cancellation + deadline.

```go
func (s *Service) Fetch(ctx context.Context, id string) (*Item, error) {
    // pass ctx to every downstream call
}
```

Never accept `context.TODO()` from a caller — that's a sign someone above you didn't have a real context yet. Push the requirement up.

Background goroutines get their own context derived from the parent (don't capture `r.Context()` and outlive the request).

---

## 8 · Naming

### Package names: singular, short, specific

```go
// Bad
package httputils   // plural
package hooks       // too generic, collides
package utils       // means nothing

// Good
package httputil
package dbhook
package saashook
```

Underscore-style paths (`api/db/dbhook`, `saas/hook`) over generic ones (`api/db/hook`) when ownership clarity matters.

### Structs: relationship reads in order

"A X has many Y" or "Y belongs to X" → `XY`:

```go
type GroupUser struct{} // group has many users
type UserImage struct{} // user has many images
```

### Exported names get a doc comment that starts with the symbol name

```go
// ParseConfig loads and validates the config from path. Returns *Config on
// success; on parse failure the error wraps the file location.
func ParseConfig(path string) (*Config, error) {}
```

Unexported code: brief comments where they add clarity; skip the noise.

---

## 9 · Service / package design

### Accept interfaces, return structs

```go
// Good
func Process(r io.Reader) (*Result, error) {}
```

Caller can pass `*os.File`, `*bytes.Reader`, an in-memory mock — your tests stay clean.

### Dependency injection, NOT package-level globals

```go
// Good — dep is injected, lifetime + replaceable in tests
type Service struct { db *ent.Client }
func New(db *ent.Client) *Service { return &Service{db: db} }

// Bad — every method silently depends on initialization order
var globalDB *ent.Client
func DoThing(...) { globalDB.User.Query()... }
```

### Keep packages focused

One clear responsibility per package. When a single file grows past ~600 lines or two unrelated concerns share state, split it.

### Don't `panic` for operational errors

`panic` only for init-time fatal failures (config missing, can't bind port). Operational errors return `error`.

`log.Fatal` is banned — it kills graceful shutdown. Return an error to `main`, let it decide.

---

## 10 · Logging — `lace/gozap`

Always `lace/gozap` (wraps zap + OTEL hooks). Never stdlib `log`, `fmt.Println`, or `fmt.Printf` for application output.

```go
import (
    "lace/gozap"
    "go.uber.org/zap"
)

// With context (preferred — propagates trace_id, span_id):
gozap.FromCtx(ctx).Info("operation done",
    zap.String("user_id", userID),
    zap.Int("count", count),
)

// Without context:
gozap.GetLogger().Warn("rate limit approaching", zap.Int("current", n))
```

**Rules:**

- **Log at the boundary** (handler, resolver, job entry, cron entry). Services return errors; callers log.
- **Structured fields**, never string interpolation. `zap.Error(err)` for errors, `zap.String/Int/Duration/Bool` for values.
- **Never log secrets** — password, token, API key, encrypted blob. Wrap sensitive ent fields with `field.String(...).Sensitive()` so the auto-logger skips them.
- `gozap.FromCtx(ctx)` automatically adds `trace_id` + `span_id` from the OTEL span on `ctx`. Use it everywhere context is in scope.

**Log levels:**

| Level | When |
|---|---|
| `Debug` | Development / verbose troubleshooting; disabled in prod by default |
| `Info` | Normal operations, milestones, request/job lifecycle |
| `Warn` | Recoverable degradation; rate-limit approaches; deprecations |
| `Error` | Failure that needs attention (alerting / on-call) |

`Fatal` is banned outside `main` startup — same reasoning as `panic` (§9).

---

## 11 · Tracing — OTEL via `lace/gotel`

Add a span at every meaningful operation boundary:

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/codes"

    "lace/gotel"
)

// Helper form (preferred for service code):
telem := gotel.MustGetTelemetry()
ctx, span := telem.TraceStart(ctx, "order.process")
defer span.End()

span.SetAttributes(
    attribute.String("order.id", orderID),
    attribute.Float64("order.amount", amt),
)

if err := work(ctx); err != nil {
    span.SetStatus(codes.Error, err.Error())
    span.RecordError(err)
    return err
}
span.SetStatus(codes.Ok, "success")
```

**Span naming:** `<component>.<operation>` (`order.create`, `cron.cleanup`, `nats.orders.created`). Use a consistent per-component tracer name.

Auto-traced for free: DB queries (ent operations with `ctx`), HTTP handlers (gin middleware in `lace/ginserver`), message-bus subscribers (`lace/natso`). Add custom spans for business-meaningful steps inside.

**CLI commands** that produce traces — give OTEL time to flush before exit:

```go
defer gotel.MustGetTelemetry().Shutdown(ctx) // or time.Sleep(2 * time.Second) as a fallback
```

---

## 12 · ORM rules (ent specifics)

### Use generated field constants, never string field names

```go
// Bad — silent breakage on rename
Order(ent.Desc("created_at"))

// Good — refactor-safe
Order(ent.Desc(user.FieldCreatedAt))
```

Applies anywhere ent emits a `Field<Name>` constant — predicates, ordering, group-by, raw SQL builders.

### Schema field comments at the declaration

Every field gets a single-line comment above it explaining what it stores. When the value can take multiple shapes based on the writer, the COMPLETE shape enumeration goes in the comment:

```go
// owner_type — entpoly morph key ('product' | 'product_model' | 'collection').
// Variants are Product rows with parent_id != null; distinguish via JOIN to
// product.parent_id, NOT by inventing a 'variant' morph key.
field.String("owner_type").Optional(),
```

No separate "schema doc" file — comments live with the field.

### Foreign keys policy

Project default is `migrate.WithForeignKeys(false)` (validation is app-layer-only). Configure ONCE at the migration layer, not ad hoc in SQL.

### Sensitive fields

```go
field.String("password").Sensitive()      // hidden from logs/debug
field.String("api_token").Sensitive()
```

The `Sensitive()` marker strips the field from auto-logging (`gozap` honors it via ent's marshaler).

---

## 13 · Validation — `valgo` for business rules

```go
import "github.com/cohesivestack/valgo"

val := valgo.Is(
    valgo.String(in.CustomerID, "customer_id").Not().Empty(),
    valgo.Number(in.Amount, "amount").GreaterThan(0),
    valgo.String(in.Currency, "currency").InSlice([]string{"USD", "EUR", "GBP"}),
)
if !val.Valid() {
    return fmt.Errorf("validation failed: %v", val.Errors())
}
```

**Where to validate:**

| Layer | What |
|---|---|
| GraphQL schema | Type / nullability — gqlgen enforces |
| Resolver | Authorization, request-shape checks |
| Service entry | Business invariants (the `valgo` block) |
| Ent schema | Structural constraints (unique, not null, max length) |

Validate ONCE at the boundary. Don't re-validate the same input downstream.

---

## 14 · File / resource keys

**Filesystem-derived keys (file locks, cache keys, S3 prefixes) are lowercase + ASCII.**

```go
// Good
filelock.New("mailerlitesubscribechargegroup")

// Bad — case-sensitivity bites on Linux, behaves on macOS
filelock.New("MailerLiteSubscribeChargeGroup")
```

If the human-readable key has natural casing, normalize with `strings.ToLower` once at the boundary.

---

## 15 · Tests

**Table-driven for any function with > 2 cases:**

```go
func TestParse(t *testing.T) {
    for _, tc := range []struct {
        name, in string
        want     int
        wantErr  bool
    }{
        {"empty", "", 0, false},
        {"single", "a", 1, false},
        {"invalid", "??", 0, true},
    } {
        t.Run(tc.name, func(t *testing.T) {
            got, err := Parse(tc.in)
            if (err != nil) != tc.wantErr {
                t.Errorf("Parse(%q) err = %v, wantErr %v", tc.in, err, tc.wantErr)
            }
            if got != tc.want {
                t.Errorf("Parse(%q) = %d; want %d", tc.in, got, tc.want)
            }
        })
    }
}
```

**Mock external services** (HTTP, S3, third-party APIs) — never let a test hit the real network.

**Test error paths, not just happy paths.** Most regressions live in the error branch.

**`t.Parallel()` on every test that's truly independent** — they run faster, and parallel-incompatible state shows up loudly.

**Ent unit tests** — use the SQLite in-memory driver via `enttest.Open(t, "sqlite3", "file:ent?mode=memory&_fk=1")`. Real Postgres only in integration tests gated by a `*_TEST_DATABASE_URL` env var.

---

## 16 · Codegen-driven helpers need a runnable example

For anything feeding a code generator (ent field builders, sqlc / protoc / openapi templates, gqlgen scalars, entpoly mixins), unit-testing the helper's return value alone is INSUFFICIENT — those tests run in a vacuum and skip the generator.

**Ship a runnable example that:**

1. Runs `go generate` (or equivalent task) → produces the generated artifact
2. `go build ./...` → confirms the artifact compiles
3. A tiny end-to-end demo exercises the artifact → asserts runtime behavior

CI must fail if the generated code doesn't compile or the demo's assertions fail. Skipping this lets template-level bugs ship green.

---

## 17 · Concurrency

**Every goroutine has a clearly-defined exit condition.** If you can't point to where + when it stops, you've shipped a leak.

```go
// Good — context cancellation closes the loop
go func() {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-incoming:
            handle(msg)
        }
    }
}()

// Bad — runs forever; no way to stop it
go func() {
    for msg := range incoming {
        handle(msg)
    }
}()
```

**Always pair `go` with cancellation context.** A bare `go func()` in a long-lived process is a smell. Background workers accept `ctx` and exit on `<-ctx.Done()`. One-shot fire-and-forget goroutines must be very short and self-bounded.

**Channels:**

- The SENDER closes a channel, never the receiver.
- Closing a closed channel panics. Use `sync.Once` if there are multiple potential closers.
- Reading from a closed channel returns the zero value forever — use the comma-ok form when you need to distinguish: `v, ok := <-ch`.
- Buffer size > 0 is a design decision (decouple producer/consumer); buffer of 1 is often used to signal "completed". Default to unbuffered unless you can articulate why.

**Sync primitives — pick the right one:**

| Tool | When |
|---|---|
| `sync.Mutex` | Protect shared mutable state inside one struct |
| `sync.RWMutex` | Heavy reads, occasional writes — measure before assuming this is faster |
| `sync.Once` | Lazy init, exactly-once close |
| `sync.WaitGroup` | Wait for N goroutines to finish |
| `errgroup.Group` | WaitGroup + first-error propagation + context cancellation (almost always what you want over WaitGroup) |
| `atomic.*` | Single-counter / single-flag updates; avoid when a Mutex is clearer |
| `sync.Map` | Only when measured — usually a `map + Mutex` is clearer and as fast |

**`errgroup` over `WaitGroup`** for any fan-out where one failure should cancel siblings:

```go
g, gctx := errgroup.WithContext(ctx)
for _, item := range items {
    item := item // local copy for closure (pre-Go-1.22)
    g.Go(func() error { return process(gctx, item) })
}
if err := g.Wait(); err != nil { return fmt.Errorf("fanout: %w", err) }
```

**Race detector is non-negotiable in CI.** `go test -race ./...` on every PR. A race that ships will reproduce in production at 3am.

**The loop-variable capture trap** (Go 1.22+ fixes the `for _, x := range` case but NOT `for i := 0; …`):

```go
// Pre-Go-1.22 + plain for-loops: capture is shared
for i := 0; i < n; i++ {
    go func() { fmt.Println(i) }() // prints n, n, n — i is shared
}

// Fix: local copy
for i := 0; i < n; i++ {
    i := i
    go func() { fmt.Println(i) }()
}
```

---

## 18 · Defer

**Defer runs in LIFO order**, after the surrounding function returns. Useful for cleanup; trapdoor for resource lifetime.

**Check the error from deferred Close:**

```go
// Bad — drops Close error silently
defer f.Close()

// Good — captures and surfaces it (use named return for clean propagation)
func readFile(p string) (out []byte, err error) {
    f, err := os.Open(p)
    if err != nil { return nil, err }
    defer func() {
        if cerr := f.Close(); cerr != nil && err == nil {
            err = fmt.Errorf("close %s: %w", p, cerr)
        }
    }()
    return io.ReadAll(f)
}
```

For writes (`os.File`, `bufio.Writer`) the Close error signals a flush failure — never drop it.

**Don't `defer` inside loops** that run many iterations:

```go
// Bad — N files held open simultaneously
for _, name := range files {
    f, _ := os.Open(name)
    defer f.Close() // accumulates; closes only at func return
    process(f)
}

// Good — explicit scope per iteration
for _, name := range files {
    func() {
        f, _ := os.Open(name)
        defer f.Close()
        process(f)
    }()
}
```

**`defer` evaluates arguments immediately**, runs the call later:

```go
i := 0
defer fmt.Println(i) // prints 0
i = 5
// (function returns; prints "0")
```

For the final value, use a closure: `defer func() { fmt.Println(i) }()`.

---

## 19 · Time

**Always pass `time.Time` with a zone.** Zone-less time is a bug waiting to happen.

```go
// Good
t := time.Now().UTC()
t := time.Date(2026, 5, 25, 14, 0, 0, 0, time.UTC)

// Bad — relies on the server's local zone
t := time.Date(2026, 5, 25, 14, 0, 0, 0, time.Local)
```

**Don't compare `time.Time` with `==`** — monotonic clock readings make two "equal" times unequal. Use `.Equal()`:

```go
// Bad
if t1 == t2 { ... }

// Good
if t1.Equal(t2) { ... }
```

**Strip the monotonic reading when serializing / storing**: `t.Round(0)` or `t.UTC()` drops it. Otherwise reads-back-from-DB never `.Equal()` writes-to-DB.

**Never `time.Sleep` in production code** to wait for a condition — use a channel + timer or `context.WithTimeout`. `time.Sleep` is fine in tests only when the timing IS the test.

**Durations as typed values, not numbers:**

```go
const defaultTimeout = 30 * time.Second // good
const defaultTimeout = 30               // 30 what?
```

---

## 20 · Receivers and the nil-interface gotcha

**Be consistent: a type uses either pointer OR value receivers, not both.** Mixing makes the method set unpredictable for interface satisfaction.

```go
// Good — all pointer receivers (the common choice for anything stateful)
func (s *Service) DoA() error { ... }
func (s *Service) DoB() error { ... }
```

Pointer receivers for: stateful types, large structs, anything that mutates the receiver, anything that needs interface satisfaction with mutation. Value receivers for: small immutable types (`time.Time`, `uuid.UUID`, simple wrappers).

**The infamous nil-interface gotcha:**

```go
func mayFail() error {
    var e *MyError = nil
    return e // ← returns a non-nil interface holding a nil concrete value
}

if err := mayFail(); err != nil {
    // This branch RUNS even though e was nil — interface header is non-nil
}
```

Rule: **never return a typed nil through an interface return type.** Return literal `nil`, or check before returning:

```go
func mayFail() error {
    var e *MyError
    if shouldFail { e = &MyError{...} }
    if e == nil { return nil } // explicit nil-interface return
    return e
}
```

Bites everyone exactly once. Recognize the pattern in review.

---

## 21 · HTTP client

**Always set a timeout** on the client OR per-request via context. The default `http.Client` has NO timeout — a hung server hangs your process indefinitely.

```go
// Good
client := &http.Client{Timeout: 30 * time.Second}

// Or per-request (preferred when callers have a context):
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
resp, err := client.Do(req)
```

**Reuse one `http.Client` per dependency.** Constructing per-request leaks connections and disables keep-alives. One client per service, stored on the struct.

**Always close the response body**, even on error:

```go
resp, err := client.Do(req)
if err != nil { return nil, err }
defer resp.Body.Close()
// Drain body so the connection can be reused:
defer io.Copy(io.Discard, resp.Body)
```

**Status codes are not errors** — `client.Do` returns `nil` error for 4xx/5xx. Check `resp.StatusCode` explicitly.

`lace/httpreq` wraps these defaults — prefer it over rolling your own `http.Client` (§1).

---

## 22 · `context.Value` rules

**`context.Value` is for REQUEST-SCOPED data only** — trace IDs, user identity extracted from a token, tenant scope. NEVER:

- Configuration (use struct fields / DI)
- Optional parameters (use functional options)
- Function arguments masquerading as ambient state

**Always use a typed unexported key:**

```go
// Good — collision-proof, untyped misuse blocked
type ctxKey int

const userKey ctxKey = 0

func WithUser(ctx context.Context, u *User) context.Context {
    return context.WithValue(ctx, userKey, u)
}

func UserFromContext(ctx context.Context) *User {
    u, _ := ctx.Value(userKey).(*User)
    return u
}

// Bad — string key, anyone can read/overwrite
ctx = context.WithValue(ctx, "user", u)
```

Exported accessors live with the key in the same package. Callers NEVER `ctx.Value(...)` directly.

**Never pass `context.Background()` from inside a function that received a `ctx`.** Use the received one (or derive with `context.WithTimeout`). Calling `context.Background()` breaks cancellation propagation.

---

## 23 · Constructors

**Functional options for anything with > 3 optional fields:**

```go
type Service struct {
    db      *ent.Client
    logger  *zap.Logger
    timeout time.Duration
    retries int
}

type Option func(*Service)

func WithLogger(l *zap.Logger) Option    { return func(s *Service) { s.logger = l } }
func WithTimeout(d time.Duration) Option { return func(s *Service) { s.timeout = d } }
func WithRetries(n int) Option           { return func(s *Service) { s.retries = n } }

func New(db *ent.Client, opts ...Option) *Service {
    s := &Service{db: db, timeout: 30 * time.Second, retries: 3}
    for _, opt := range opts { opt(s) }
    return s
}

// Caller picks what they need:
svc := New(db, WithLogger(l), WithRetries(5))
```

Beats a giant `Config` struct (every call site has to construct it, zero value of a missing field is silent) and a long positional argument list (`New(db, l, 30*time.Second, 3, true, nil)` — what's the `true` for?).

**`iota` for related constants** when the underlying numeric value doesn't matter:

```go
type Severity int

const (
    SevDebug Severity = iota
    SevInfo
    SevWarn
    SevError
)
```

For string constants where the value IS the API (status codes, sort keys), DON'T use iota — explicit string values per §2.

**Don't use named return values except for documentation or defer rebinding** (see §18's Close-error pattern). Named returns silently zero on early return and obscure flow.

---

## 24 · Tooling + module hygiene

**Required CI checks, every PR:**

- [ ] `gofmt -l .` — zero diff
- [ ] `go vet ./...`
- [ ] `go test -race ./...`
- [ ] `staticcheck ./...` (or `golangci-lint run` if the project uses it)
- [ ] `go build ./...` — workspace clean

**Module hygiene:**

- `go.mod` declares the minimum supported Go version — bump deliberately, never silently.
- `go mod tidy` runs in CI; PR fails if it modifies `go.mod` / `go.sum`.
- `replace` directives are a smell — fine for local workspace development, but a `replace` landing in `go.mod` on the default branch needs a reason in the commit message.
- Pin dep versions; never `latest`. `go get pkg@v1.2.3`, not `go get pkg`.

**`init()` functions: avoid.** They run automatically, in unspecified order, with no failure path. If you need setup, expose it as an explicit `Init(ctx) error` or constructor the caller invokes.

Acceptable `init()` uses (narrow):

- Registering a driver with `database/sql.Register` (idiomatic, no alternative)
- Registering a codec with `encoding/gob.Register`
- Registering a test-only flag

Everything else: lift into a constructor.

**`doc.go`** for package-level documentation when the `package` clause doc-comment grows past ~5 lines.

---

## 25 · JSON, encoding, random

**JSON struct tags MUST be set explicitly** on every exported field that's serialized. Don't rely on Go's default field-name lowercasing — be explicit:

```go
type User struct {
    ID    string `json:"id"`
    Email string `json:"email"`
    pwd   string // unexported, never serialized
    Token string `json:"-"` // sensitive but exported — strip explicitly
}
```

**`omitempty` is a footgun for value types:**

- `int` zero is `0`, which `omitempty` drops — even when 0 is meaningful.
- `bool` zero is `false`, dropped when false matters.
- Use pointer (`*int`, `*bool`) when "field absent" differs from "field is zero".

**Custom marshalers**: implement `json.Marshaler` / `Unmarshaler` for types that need a non-default wire shape (money as `"19.99"` string, time as ISO-8601-without-zone). Hide the conversion behind the type; never sprinkle the wire shape across call sites.

**Random — pick the right source:**

| Use | Source |
|---|---|
| Crypto (tokens, IDs, nonces, password salts) | `crypto/rand` |
| Anything user-visible (game logic, jitter, sampling) | `math/rand/v2` (Go 1.22+) |
| Pre-Go-1.22 non-crypto | `math/rand` (seed it once at init) |

Never use `math/rand` for security. Never roll your own RNG.

---

## 26 · Composition over embedding

Embed sparingly. Deep embedding chains make the method set unpredictable and obscure where behavior comes from:

```go
// OK — composition with a clear named field
type Service struct {
    db  *ent.Client
    log *zap.Logger
}

// Smell — embed something with a wide method set; consumers can't tell
// which methods are "yours" vs the embedded type's
type Service struct {
    *http.Client     // 15+ methods now appear on Service
    *sql.DB          // 20+ more
}
```

When you embed, do it because you genuinely want the full method set surfaced AND a stable contract. If you only want one or two methods, write thin wrapper methods explicitly.

---

## 27 · Secrets

### 27.0 · AI-AGENT: READ THIS FIRST

A failure pattern that has bitten real sessions: an AI agent pastes a real credential the human shared (in chat, in a `.env` they were debugging, in a log excerpt) into a "for reference, rotate when convenient" note in a tracked doc. Then commits and pushes. Then the credential is unrotatable because it's a customer's production value, and the recovery cost is a delete-and-recreate of the remote repo + a force-push of a scrubbed history + permanent residual risk that some scraper got there first.

The shapes the agent talks itself into — every variation has actually happened:

| Anti-pattern | Why the agent reaches for it | Why it's wrong |
|---|---|---|
| "I'll paste the real token in the gotcha doc so future-me knows which token it is" | Future-me will need to identify which credential broke things | The doc lives in git; git lives on a remote; bots scrape remotes within minutes of push |
| "It's a private repo, fine" | Conservation of effort | Private repos still leak via forks, mirrors, ex-employee clones, CDN caches, and any future visibility change |
| "I'll scramble a few characters so it's not the *real* token" | Plausible-looking deniability | Token shape is recoverable; the prefix + length give it away; brute-force fills the rest |
| "It's in a Go comment, the linter won't catch it" | Comments are "just text" in my head | They're text in `git diff` too |
| "It's a dev/test value, not prod" | Trying to convince myself it's safe | When you're wrong, you're wrong with prod |
| "I'll just add it to the migration's pre-flight SQL example block" | The example needs to be runnable | Runnable doesn't require *the actual value*; placeholders like `<TOKEN>` work fine |
| "I'll write the failure-mode postmortem with the real token in it so future agents see what to avoid" | Vivid examples teach better | The postmortem doc gets committed too. The teaching value is the *shape*, never the value. |

**THE RULE, restated for any AI agent reading this section in a future session:**

> If a value's shape matches anything in §27.2's pattern list, it does NOT go into any file the agent writes. Not in `.go`, not in `.md`, not in a commented-out line, not in a `// usage example`, not in a `// remember to rotate this` breadcrumb, not in a postmortem describing how the value leaked. Not even "temporarily, I'll redact before commit". The pre-commit hook catches most of it; the rest depends on the agent acquiring the reflex to TYPE the placeholder (the literal text `shpat_xxx` or `<TOKEN>` or `${SOMETHING_TOKEN}`) rather than the literal value, every single time, every file.
>
> When the human SHOWS the agent a real credential in chat (paste, screenshot, log excerpt), the agent does NOT echo it back, does NOT save it to a memory store, does NOT write it into a "rotate this later" note. The agent acknowledges the value's existence in abstract terms (`"the Shopify token the user shared"`, `"the OpenAI key in the log"`) and tells the human to put it in `.env` themselves.

If the agent reads this paragraph and the next move is "but the user explicitly asked me to put it in a comment so they could find it later" — STOP. The user is not the threat model. Scrapers, fork holders, CDN caches, and copy-paste accidents are. The user can always look the value up in their `.env`; they cannot un-paste it from a public commit.

**Test the rule before writing anything:** before saving any file, the agent scans its own draft for any substring matching the §27.2 patterns. If a match exists and isn't allow-listed (a literal placeholder like `shpat_xxx`), it's a refuse — rewrite the draft with `<TOKEN>` or `${TOKEN_ENV_VAR}` and try again. This is cheaper than discovering it via the pre-commit hook, much cheaper than discovering it via a code-search scraper.

The rest of this section is the operational support for the rule.

### 27.1 · The hard rules (no exceptions)

- **NEVER paste a real credential into ANY tracked file.** Not in `.go`, not in `.md`, not in a `// commented-out` block, not in a CLI usage example, not in a test fixture, not in a README "for reference", not in a CLAUDE.md gotcha doc, not in a commit message. Even "I'll rotate it later" — no. The minute the literal value sits in a git diff, assume scrapers have it within minutes of `git push`. Public-repo Shopify tokens (`shpat_…`), AWS keys (`AKIA…`), Stripe keys (`sk_live_…`), OpenAI/Anthropic keys (`sk-…`), and GitHub PATs (`ghp_…`) all have known harvesters watching commit feeds; even private-repo commits leak via misconfigured cache CDNs, accidental forks, and former-employee clones.
- **Real credentials live in `.env` (gitignored) and ONLY in `.env`.** The repo's `.env` is per-machine, never committed. A committed `sample.env` ships with placeholder values only (`shpat_xxx`, `sk-xxx`, etc.).
- **Reach into Go via `os.Getenv` (raw) or the project's config layer** (PKL `read("env:VAR_NAME")` in this stack). Never via a string literal inside the source file.
- **Docs + examples use placeholders.** When showing usage in a README / CLAUDE.md / package doc, the placeholder is the literal text `shpat_xxx` or `<TOKEN>` — never a real one, never a "scrambled" one (scramblers fail; the original key shape is recoverable).
- **`field.String("password").Sensitive()`** on every ent field holding a secret — strips from logs / debug / `String()` output.
- **`lace/crypt`** (AES) for anything encrypted at rest in the DB. CLI for one-off encrypt/decrypt: `go run ./saas/cmd/cli crypt -e "value"` / `-d "encrypted"`.
- **`subtle.ConstantTimeCompare`** for API-key comparisons — timing-attack-safe.
- **Gitignored at the start of every project:** `.env*`, `_keys/`, `*.pem`, `*.key`, `*.creds`, `.github/.secrets*`. Verify with `git check-ignore` before adding any sensitive-looking file.

### 27.2 · Pre-commit secret scanner (defense-in-depth)

Human attention loses to fatigue; `git config core.hooksPath` doesn't. Every Go project of ours ships with `.githooks/pre-commit` that scans staged additions for credential-shaped patterns and refuses the commit if it finds one. Activated per-clone via a `task hooks:install` Taskfile entry (each dev runs it once after `git clone`).

The scanner refuses any commit whose added lines match these patterns (each new shape we encounter gets added to the list — the list grows, never shrinks):

```
shpat_[a-f0-9]{32}            Shopify Admin API access token
shpca_[a-f0-9]{32}            Shopify customer token
shpss_[a-f0-9]{32}            Shopify storefront token
sk-[A-Za-z0-9]{20,}           OpenAI / Anthropic style
sk-proj-[A-Za-z0-9_-]{20,}    OpenAI project keys
ghp_[A-Za-z0-9]{36}           GitHub PAT
gho_[A-Za-z0-9]{36}           GitHub OAuth
AKIA[0-9A-Z]{16}              AWS access key id
aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}
-----BEGIN [A-Z ]*PRIVATE KEY-----
rk_(live|test)_[A-Za-z0-9]{20,}    Stripe restricted
sk_(live|test)_[A-Za-z0-9]{20,}    Stripe secret
```

An `ALLOW_RE` substring list takes precedence so deliberate placeholders (`shpat_xxx`, `shpat_…`, `sk-xxx`, `REDACTED`) commit cleanly. Bypass via `git commit --no-verify` exists for emergencies but the rule is: **if you find yourself bypassing, the matching pattern needs a new ALLOW_RE entry so the next dev doesn't have to bypass.**

Reference implementation lives in every project as `.githooks/pre-commit`. Install via `task hooks:install` (`git config --local core.hooksPath .githooks`). The hook is committed to the repo so every clone has identical detection logic.

### 27.3 · If a secret already leaked

`git log --all -p -S 'secret-value' --pretty=format:'%H %s'` finds every commit that introduced or removed the literal string. Then choose your blast radius:

1. **ROTATE FIRST, scrub second.** The token is public from the moment it lands on a remote — scrubbing history reduces the window for fresh discovery, it does not invalidate the leaked value. If rotation is genuinely impossible right now (the customer needs to coordinate), the scrub is still worth doing but you must explicitly accept that the credential is compromised until rotated.
2. **`git filter-repo --replace-text patterns.txt`** is the modern tool (BFG and `git filter-branch` work but filter-repo is faster and safer). The replacements file uses `==>` to map each literal/regex to a redacted placeholder:
   ```
   shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx==>[REDACTED-SHOPIFY-TOKEN]
   regex:shpat_[a-f0-9]{32}==>[REDACTED-SHOPIFY-TOKEN]
   ```
3. **Force-push** to the same remote OR (the most aggressive option) delete the remote repo and recreate empty (`gh repo delete <org>/<name> --yes && gh repo create <org>/<name> --private && git push -u --force origin main`). Deleting wipes PRs / issues / actions / fork links / stars; it does NOT touch existing forks or GitHub's edge caches (those persist 30–90 days; for serious leaks file a GitHub support ticket asking for cached-view + fork purge with the affected commit SHAs).
4. **Clean every remote-tracking ref locally** before the local-repo `git gc --prune=now --aggressive` — refs/remotes/origin/* still pin the old commits and prevent GC. Either `git remote remove origin` then re-add, or delete the refs by hand.
5. **Stage a backup before any history rewrite** — `git bundle create /tmp/<repo>-backup-$(date +%Y%m%d-%H%M%S).bundle --all`. The rewrite is irreversible without it.

### 27.4 · Operational habits that prevent re-occurrence

- When dropping a "for reference" credential into a gotcha note, do NOT include even a prefix — name the credential by its **purpose-derived alias** (`SHOPIFY_BADNO_TOKEN`, `OPENAI_PROD_KEY`) and put the real value in `.env` only. The alias is the value the doc references; the real secret lives in `.env` exclusively. Even a "prefix only" leak gives scrapers enough to begin enumerating.
- For development convenience CLIs (`saas/cmd/cli auth bootstrap --owner-password=…`), default the secret to a fixed dev string (`admin`) AND refuse the default in `CONFIG_ENV=prod`. Document the env override (`AUTH_BOOTSTRAP_PASSWORD=…`) in the same `--help` text. Same shape protects every "for local dev" credential.
- When pasting an example into a chat reply, redact the credential first. The chat log lives forever.

---

## 28 · Migration discipline

**Before ANY schema change:**

- [ ] Full DB dump backup with a timestamped filename
- [ ] Count existing rows that will be affected — `> 1000` rows = high risk
- [ ] Pre-flight SQL (rename, backfill, index drops) wrapped in `BEGIN; … COMMIT;`
- [ ] Schema rewrite → run generator → run migrate
- [ ] Verify row counts preserved (`SELECT owner_type, COUNT(*) FROM … GROUP BY owner_type`)
- [ ] Sweep all read paths for renamed columns / changed types
- [ ] Build clean across all modules
- [ ] Tests pass

**ent migrate caveats** (project defaults):

- `WithDropColumn(false)` — migrate ADDS columns but never DROPs. Old columns linger until you drop them manually in pre-flight SQL.
- `WithDropIndex(false)` — old indexes linger; drop in pre-flight when renaming columns they reference.
- `WithForeignKeys(false)` — no FK enforcement; app layer owns it.

**Risky changes need staging:**

| Change | Strategy |
|---|---|
| Add required field on populated table | Optional + default → backfill → make required |
| Rename column | Add new col → copy data → drop old in next migration |
| Add unique constraint | Pre-flight SQL dedup → then add constraint |
| Change field type | Verify Postgres can cast (e.g. `varchar→jsonb` needs `USING value::jsonb`) |

---

## 29 · Documentation lives where the code is

- Field comments at the field declaration, not in a sidecar `SCHEMA.md`.
- Exported function doc comments start with the symbol name.
- Hotpath gotchas (race window, retry semantics, idempotency guarantee) go in a comment above the function, NOT in `README.md`.
- "Why this is weird" comments — write them. The next person (you, in 3 months) will thank you.

---

## 29.5 · Multi-tenant safety — workspace/tenant isolation

When a Go API serves multiple tenants (workspaces / orgs / teams / accounts) out of one DB, EVERY resolver, handler, query, and mutation must scope to the caller's tenant — and the tenant id must come from the AUTHENTICATED CONTEXT, not from a client-supplied header, URL param, query string, or input field. A cross-tenant read or write is the canonical multi-tenant security failure, and the fix is structural — the seam goes in middleware, not at each call site.

### 29.5.1 · The pattern — `RequireTeam` middleware

A single middleware in the auth layer extracts the workspace id from the session/JWT and stuffs it into the request context via a typed key. EVERY downstream consumer reads the workspace id from context only.

```go
// authmw/team.go
type workspaceCtxKey struct{}

// RequireTeam ensures the session has an active workspace and pins it into ctx.
// Resolvers + queries that handle tenant data must wrap or pull from this.
func RequireTeam(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sess := SessionFromContext(r.Context())
		if sess == nil || sess.WorkspaceID == "" {
			http.Error(w, "no active workspace", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), workspaceCtxKey{}, sess.WorkspaceID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func WorkspaceFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(workspaceCtxKey{}).(string)
	return id, ok && id != ""
}
```

Every resolver / service method that touches tenant data takes `ctx`, calls `WorkspaceFromContext(ctx)`, and uses the returned id to scope its query — NEVER an id from the input struct, NEVER an id from a header, NEVER an id from the URL.

```go
func (r *queryResolver) Products(ctx context.Context) ([]*ent.Product, error) {
	wsID, ok := authmw.WorkspaceFromContext(ctx)
	if !ok {
		return nil, errors.New("no workspace")
	}
	return r.db.Product.Query().Where(product.WorkspaceID(wsID)).All(ctx)
}
```

Anti-pattern (cross-tenant read waiting to happen):

```go
// BAD — workspace ID comes from the request input, not the context
func (r *queryResolver) Products(ctx context.Context, input ProductFilter) ([]*ent.Product, error) {
	return r.db.Product.Query().Where(product.WorkspaceID(input.WorkspaceID)).All(ctx)
}
```

A caller authenticated for workspace A can pass `input.WorkspaceID = B` and read B's products. Even if the front end doesn't do this, an attacker poking at the GraphQL endpoint will.

### 29.5.2 · Owner-only operations: server enforces, client is just UX

When some operations are restricted (e.g. only the workspace **owner** can rename or delete a tenant, only **admin** can invite members), the client UI hides the controls — but the server enforces them again at the resolver. The client gate is UX, not a security boundary.

```go
func (r *mutationResolver) DeleteWorkspace(ctx context.Context, id string) (bool, error) {
	wsID, _ := authmw.WorkspaceFromContext(ctx)
	if id != wsID {
		return false, errors.New("forbidden")
	}
	sess := authmw.SessionFromContext(ctx)
	role, err := r.db.Membership.Query().
		Where(membership.WorkspaceID(wsID), membership.UserID(sess.UserID)).
		Only(ctx)
	if err != nil || role.Role != "owner" {
		return false, errors.New("only the owner can delete this workspace")
	}
	return true, r.db.Workspace.DeleteOneID(id).Exec(ctx)
}
```

Two checks, one resolver: (1) the resource lives in the caller's tenant; (2) the caller has the right role. Both server-side, both unskippable.

### 29.5.3 · Membership lookups belong to a service, not inline

If three resolvers re-implement the "is this user an owner?" check, the fourth will get it wrong. Centralize:

```go
// authsvc/membership.go
func (s *Service) MustBeOwner(ctx context.Context, wsID, userID string) error {
	m, err := s.db.Membership.Query().
		Where(membership.WorkspaceID(wsID), membership.UserID(userID)).
		Only(ctx)
	if err != nil {
		return fmt.Errorf("no membership: %w", err)
	}
	if m.Role != "owner" {
		return errors.New("forbidden: owner only")
	}
	return nil
}
```

Resolvers call `s.auth.MustBeOwner(ctx, wsID, sess.UserID)`. One implementation, one place to fix the role-check logic.

### 29.5.4 · Audit gate before shipping a multi-tenant change

Before merging any PR that touches a tenant-scoped resolver or query, run:

```bash
# Every Where clause that filters by workspaceID should source from context, not input.
rg "WorkspaceID\(.*input\.|WorkspaceID\(.*req\.|WorkspaceID\(.*params\." -t go
```

Any hit is a cross-tenant vulnerability — replace with the `WorkspaceFromContext(ctx)` shape from §29.5.1.

## 30 · Anti-pattern catalog

| Anti-pattern | Why banned | What to do instead |
|---|---|---|
| `case "active":` / `return "draft"` | Bare strings; one typo = silent miscompare | Typed constants (§2) |
| `Order(ent.Desc("created_at"))` | Field rename = silent breakage | Generated `<entity>.Field<Name>` (§12) |
| `field.Enum("status").Values("a","b")` baked in schema | Can't add a value without migration; can't be tenant-scoped | Reference table (§4) |
| Hand-rolled `owner_kind` + `owner_id` columns | Drifts from real ent types; convention only | entpoly `MorphMixin + MorphTo` (§3) |
| Triggers / CHECK functions / hardening SQL beyond ORM-emitted | Couples DB to behavior; locks out sharding | App-layer validation (§5) |
| Direct use of `nats.go` / `go-redis` / `pgx` when `lace/` wraps it | Bypasses project conventions (logger, telemetry, retry) | Use the `lace/` wrapper (§1) |
| stdlib `log` / `fmt.Println` for app output | No level, no fields, no trace | `lace/gozap` (§10) |
| `panic(err)` in service code | Crashes process; no graceful shutdown | Return `error`, caller decides (§9) |
| `log.Fatal(err)` anywhere except `main` startup | Same as panic; bypasses defers | Return error to `main` |
| Package-level globals | Untestable; hidden coupling | Inject via constructor (§9) |
| `context.TODO()` accepted as a parameter | Caller didn't have a real context | Push the requirement up |
| Test the helper's return value; skip the generator | Template bugs ship green | Runnable end-to-end example (§16) |
| Convention-only contracts ("just implement method X") | Silent failure when convention drifts | Enforce via type system or registration check that errors loudly |
| Sidecar translation table for i18n text | JOIN on every read | JSONB-per-locale on the row (project rules) |
| Bare `go func()` with no exit condition | Goroutine leak; eats memory forever | Pair with `ctx` + `<-ctx.Done()` (§17) |
| `sync.WaitGroup` for fan-out that can fail | First error doesn't cancel siblings | `errgroup.WithContext` (§17) |
| `defer f.Close()` (error dropped) | Silent flush/write failure | Captured-err pattern with named return (§18) |
| `defer` inside a long loop | N resources held until function returns | Wrap iteration in a closure with its own `defer` (§18) |
| `time.Date(..., time.Local)` | Server zone leaks into stored timestamps | `time.UTC` (§19) |
| `t1 == t2` on `time.Time` | Monotonic clock makes "equal" times unequal | `.Equal()` (§19) |
| `time.Sleep` to wait for a condition in prod code | Flaky; no cancellation | Channel + timer or `context.WithTimeout` (§19) |
| Returning a typed nil through an interface return | `err != nil` check passes when err is "nil" | Explicit nil-interface return (§20) |
| Mixing pointer + value receivers on one type | Method-set surprises break interface satisfaction | Pick one, stick with it (§20) |
| `http.Client{}` with no timeout | One hung server hangs the process | `Timeout:` on client OR per-request `context.WithTimeout` (§21) |
| New `http.Client` per request | Connection leak, no keep-alive | One client per dep, stored on struct (§21) |
| Not draining response body before Close | Connection can't be reused | `defer io.Copy(io.Discard, resp.Body)` then `defer resp.Body.Close()` (§21) |
| `ctx.Value("user", u)` with a string key | Collisions; type-unsafe | Typed unexported key + exported accessor (§22) |
| `ctx.Value` for config / optional params | Ambient state masquerading as args | DI for config; functional options for params (§22, §23) |
| Long positional constructor (`New(a, b, c, true, nil)`) | Call sites are unreadable; adding a param breaks every caller | Functional options (§23) |
| Named return values everywhere | Silent zero on early return; obscures flow | Plain returns; named only for defer-rebinding (§23) |
| `init()` for setup beyond driver registration | Implicit order, no failure path | Explicit constructor / `Init(ctx) error` (§24) |
| `replace` directive landing on default branch | Hidden local-only state | Either pin a real version or document why in commit message (§24) |
| `math/rand` for tokens / IDs / nonces | Predictable; security failure | `crypto/rand` (§25) |
| `omitempty` on `int` / `bool` where zero is meaningful | "0" or "false" silently disappears | Use `*int` / `*bool` for "absent vs zero" (§25) |
| Embedding a wide-API type (`*http.Client`, `*sql.DB`) on a service struct | Consumers can't tell which methods are yours | Composition via a named field (§26) |
| Hardcoded secret in code / committed `.env` | Leak risk; rotation gets hard | PKL `read("env:VAR")` + gitignore (§27) |
| Logging a sensitive ent field | Plaintext password / token in logs | `field.String(...).Sensitive()` (§27) |
| Resolver/handler reads `workspaceID` from input / URL param / header | Cross-tenant read or write; canonical multi-tenant security failure | `WorkspaceFromContext(ctx)` set by `RequireTeam` middleware; never trust the client (§29.5.1) |
| Owner-only check ONLY on the client (button hidden) | Curl/GraphQL clients bypass instantly | Server-side resolver enforces role + tenant match every call (§29.5.2) |
| Re-implementing membership/role checks in each resolver | Drift; the 4th one will be wrong | Centralize in `authsvc.MustBeOwner` / `MustHaveRole` (§29.5.3) |

---

## 31 · Pre-PR checklist

Before saying a Go change is "done":

- [ ] §1 — no new direct dep on a library `lace/` already wraps
- [ ] §2 — every new closed-set value is a typed constant
- [ ] §3 — every new polymorphic relation uses entpoly + `MixinAllowed` + namespaced `MixinIndexName`
- [ ] §4 — no new `field.Enum` outside entpoly; new enumerations are reference tables
- [ ] §5 — no triggers, CHECK functions, hardening SQL
- [ ] §6 — every returned error wraps context (`fmt.Errorf("op: %w", err)`)
- [ ] §7 — every blocking call accepts + uses `context.Context`
- [ ] §8 — naming follows package + struct conventions
- [ ] §9 — services inject deps via constructor; no new globals
- [ ] §10 + §11 — `lace/gozap` logging at boundaries; `lace/gotel` tracing where it matters
- [ ] §12 — ORM queries use generated field constants, not strings; sensitive fields marked
- [ ] §13 — business validation via `valgo` at service entry
- [ ] §15 — new logic has table-driven tests covering happy + error paths
- [ ] §16 — codegen helpers shipped with a runnable example
- [ ] §17 — every new goroutine has a clear exit (ctx-driven); `errgroup` for fan-out
- [ ] §18 — deferred Close errors are captured; no `defer` inside long loops
- [ ] §19 — every `time.Time` is zone-aware; no `==` on times; no `time.Sleep` in prod logic
- [ ] §20 — receivers consistent on a type; no typed-nil-through-interface returns
- [ ] §21 — every `http.Client` has a timeout + reused per dep; response bodies drained + closed
- [ ] §22 — `context.Value` keys are typed unexported + exported accessor; no config in context
- [ ] §23 — constructors with > 3 optional params use functional options
- [ ] §24 — `gofmt` clean, `go vet`, `go test -race`, `staticcheck` (or `golangci-lint`) all green; `go mod tidy` no-op
- [ ] §25 — JSON tags explicit; `omitempty` only on pointer-or-string fields; `crypto/rand` for secrets
- [ ] §27 — no hardcoded secrets; sensitive ent fields use `.Sensitive()`
- [ ] §28 — if schema changed: backup taken, migration verified, row counts preserved
- [ ] §29.5 — every tenant-scoped resolver/handler sources `workspaceID` from `WorkspaceFromContext(ctx)`, NOT from input / URL / header; owner/role checks enforced server-side (run `rg "WorkspaceID\(.*input\." -t go` — expect zero hits)
- [ ] Build clean across the workspace
- [ ] Tests pass
- [ ] **Project rules read** (`golang-project.md` for THIS project's specifics on top of the above)

---

## 33 · Repo layout, Taskfile, codegen chain

Patterns we apply to every greenfield Go service. Borrowed-and-canonicalised from real projects (sync_go, lore, etc.).

### 33.1 · Module layout — `go.work` monorepo

One repo, multiple modules glued via `go.work`. Typical shape:

```
<repo>/
├── go.work               # workspace pointer file
├── go.work.sum           # COMMITTED
├── Taskfile.yml          # only entry point for reusable commands
├── apidash/              # gqlgen GraphQL server (resolvers, generated/, etc.)
├── dbent/                # ent schema + entgql + Atlas migrations
├── core/                 # domain primitives (no app glue)
├── config/               # pkl config + generated Go bindings
├── lace/                 # shared infra wrappers (pgx, NATS, sentry, otel, gozap)
├── saas/
│   ├── cmd/api/          # server entrypoint (Gin + gqlgen)
│   ├── cmd/cli/          # operator CLI
│   └── cmd/cron/         # scheduled-job entrypoint
├── scripts/              # one-off Go scripts (not part of the build)
├── examples/             # runnable demos for codegen-driven helpers (see §16)
└── vendor/               # GITIGNORED — see 33.4
```

Rules:
- New domain → new module under the repo (not a subpackage of an existing module). Modules are the unit of dependency boundary.
- `cmd/<binary>` lives inside the `saas` (or equivalent) module that owns the deployable; never as a top-level dir.
- `lace/*` is the dumping ground for thin wrappers over external libs (gozap over zap, gotel over otel, etc.) — keeps the rest of the codebase importing one project-owned wrapper instead of N versions of the upstream API.

### 33.2 · Taskfile is the only runner

Reach for **[Taskfile](https://taskfile.dev/)** (`Taskfile.yml`, `version: '3'`) for every reusable command. No npm scripts, no Makefile, no shell aliases the team has to remember. Even for Go-only projects.

- Each task needs a `desc:` so `task --list` is self-documenting.
- Per-domain task namespacing via `:` (e.g. `dbent:g`, `dbent:migrate`, `gql`, `lint`).
- Top-level commands that wrap multiple subtasks: `task upgrade` should run dep bumps + re-vendor + codegen + migrate.
- A `task setup` (or `setup:*` family) covers first-clone bootstrap so a new dev runs ONE command.
- If you find yourself typing the same `go run …` / `go test …` / `go build …` twice — that's the moment it becomes a task.

Common canonical tasks every Go service should expose:

| Task | What |
|---|---|
| `task dev` | run the API on a free port |
| `task lint` | `gofmt -s -d` + `go vet` (+ project linters) |
| `task test` | unit tests with `-race` |
| `task dbent:g` | ent regeneration |
| `task dbent:migrate` | apply schema to dev DB |
| `task gql` | gqlgen regeneration |
| `task workvendor` | `go work vendor` regenerate |
| `task upgrade` | bump module deps + re-vendor + codegen + migrate |
| `task setup` / `task setup:*` | one-shot first-time bootstrap |

### 33.3 · Codegen chain — ent → gqlgen → SDK

The chain we use for GraphQL APIs, in order:

```
ent schema (Go)                      dbent/schema/*.go
    ↓ entgql
SDL (.graphql)                       apidash/internal/graph/schemas/*.graphql
    ↓ gqlgen
typed resolvers + models             apidash/internal/graph/{generated,resolver}
    ↓ gqlkit (introspection → TS)
frontend SDK                         <frontend-repo>/src/generated/sdk
```

Rules:
- **Every stage runs through a task** (`task dbent:g`, `task gql`, frontend's own `task generate`). Never invoke the underlying generator directly — the task encodes flags / env / cwd / cleanup that hand-invoking will forget.
- **The earliest stage is the source of truth.** Hand-editing generated SDL or gqlgen output is forbidden; change the ent schema, re-run the chain.
- **Generated files are committed.** Reviewers need the diff visible; CI verifies `task <generate>; git diff --exit-code` is clean.
- **Recovery from a partial run** — see project-overlay for the exact path (e.g. `git checkout -- apidash/internal/graph/{generated,resolver}` and retry). Document the recipe in the project overlay, not here.

### 33.4 · `vendor/` is gitignored, regenerated on demand

- `go.mod` + `go.sum` (per-module) + `go.work` + `go.work.sum` (workspace) are the **committed source of truth**.
- `vendor/` is regenerated via `task workvendor` (`go work vendor`) before any operation that requires it (vendored builds, offline CI, IDE go-to-definition into deps).
- Do NOT commit `vendor/`. Every dependency upgrade would inflate the diff with thousands of lines of generated code, and the `go.mod` change already records the intent.
- A fresh clone has no `vendor/`; `task setup` (or `task workvendor`) makes it appear.

### 33.5 · Config: PKL schema + sample-only commit policy

For projects using PKL (`config/pkl/`):

- The **schema** files in `config/pkl/schema/` are committed.
- The **sample** environment in `config/pkl/env/sample/app.pkl` is committed (template).
- The **real** environments in `config/pkl/env/{default,prod}/app.pkl` are **gitignored**.
- Schema refactors update schema + sample but leave local `default`/`prod` stale → `config.Get()` panics at startup. The fix is updating your local file to match `schema/` + `sample/`. The CI build never trips this because CI uses the sample.
- A `task config:gen` (or similar) regenerates Go bindings from the schema; that output IS committed.

### 33.6 · Portless dev — fixed `.localhost` domains, dynamic ports

Local dev should use **fixed hostnames** (`https://sync-api.localhost`, `https://sync.localhost`) routed via a local CA + reverse proxy, NOT memorised port numbers.

- `task portless:trust` (once per machine) installs the local CA.
- `task dev:portless` runs the server behind the proxy — port is dynamic (`PORT` env injected by Taskfile per run), code reads it via `read?("env:PORT") ?? "<fallback>"`.
- **Never hardcode a dev port.** Port collisions across services become a per-machine problem; the host stays stable.
- Frontend / backend are routed through the same proxy so cookie domain math just works (both at `*.localhost`).

The skill doesn't pick a specific proxy — projects use whichever tool fits (Caddy, mkcert + nginx, a project-specific helper). Documented at the project overlay.

### 33.7 · Hand-maintained `CLAUDE.md` with one sentinel block

The pattern most of our projects use:

- `CLAUDE.md` at repo root is **hand-maintained**.
- ONE auto-managed sentinel block at the top of the file (e.g. `<!-- aicoder:pointer:start -->` … `<!-- aicoder:pointer:end -->`, or `<!-- lore:pointer:start -->` … `<!-- lore:pointer:end -->`) that the knowledge-base CLI re-stitches on every render. EVERYTHING else in the file is hand content and MUST be preserved across renders.
- If the project uses two rule files (canonical + project overlay), reference both from `CLAUDE.md` and explain the precedence in one sentence ("project overlay overrides canonical on conflict").
- Don't let auto-render write the full knowledge body into `CLAUDE.md` — that's what the pointed-to file is for. Keep `CLAUDE.md` lean (intent + load instructions); put the rules in the pointed file.

### 33.8 · Adjacent-repo symlink for one-tree dev

When a backend repo + a frontend repo are developed in lockstep (especially with shared codegen output), use a **gitignored symlink** from the backend to its sibling frontend:

```
sync_go/
├── web/       → ../sync_tanstack    # symlink, gitignored
└── …
```

- `task setup:web` creates the link idempotently.
- `task setup:web:unlink` removes the link (without touching the frontend repo).
- A fresh clone has no `web/` — calling `task setup:web` is part of the first-run bootstrap.

Benefit: codegen relative paths (`../web/src/generated/sdk`) work from one terminal. No multi-repo cwd dance.

---

## 32 · When in doubt

- ANSWER first if the user described a situation rather than gave an imperative. Wait for go-ahead before editing.
- Never `git commit` or `git push` without asking.
- A single imperative verb ("add X", "fix Y") = go-ahead. An interrogative / "should we…?" = discussion.
- If the project uses a knowledge-base CLI (lore, similar), search it for captured rules/decisions before substantive replies.
- If you find yourself rewriting > 5 files without confirming the approach, STOP and check in.
