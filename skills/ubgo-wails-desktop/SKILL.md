---
name: ubgo-wails-desktop
description: >-
  Package an existing Go (Gin + gqlgen + oRPC + tRPC) backend and a Web SPA
  frontend (TanStack Start / Vite / Next-static / SvelteKit-static) into a
  single native macOS desktop binary using Wails — with ZERO TCP listeners at
  runtime. Every API call from the frontend rides the Wails IPC bridge
  (`window.go.main.App.HTTP`) into the existing Gin engine in-memory via
  `httptest.NewRecorder`. No code rewrites in the backend (Gin routes,
  gqlgen schema, ent, middleware, plugins all stay). No code rewrites in the
  frontend (oRPC / tRPC / Apollo / urql / raw fetch all stay) — only a
  `fetch`-shaped transport swap via a `bridgeFetch` shim. Read this skill
  end-to-end BEFORE starting; it captures every gotcha empirically encountered
  during a real integration: Wails CLI vs Go workspace incompat, macOS
  framework linker flags (`-framework UniformTypeIdentifiers`), TanStack
  Start `_shell.html` rename, `config.Get` CWD trap, debug+devtools build
  tags for WKWebView Inspector, why the Network tab stays empty (postMessage
  bridge, not HTTP), streaming-response buffering, cookie/session domain
  scoping, vendor regeneration, Wails v2.8.1's smaller mac.Options surface.
  Includes empirical benchmarks (binary ~100MB, RSS ~155MB, 33% base64 IPC
  overhead, 9MB Wails-only overhead over the existing API binary). The user
  can be asked about backend repo path, frontend repo path, app name,
  framework choice, and any deviations; sensible defaults are provided for
  every unknown.
---

# ubgo-wails-desktop

The single reference document for turning an existing Go + Web pair into a Wails desktop binary with HTTP-shaped IPC over the bridge — every layer, every gotcha, every benchmark, every diagnostic recipe.

This skill is path-agnostic. Backend and frontend may live in **separate repos anywhere on disk**; the skill asks for paths up front.

---

## 0. TL;DR for an AI invocation

When invoked:

1. Read this entire document end-to-end before writing any code.
2. Ask the user the questions in **§4** (paths, app name, framework, etc.).
3. Execute **§7** step-by-step, substituting the user's answers into the `<placeholder>` variables.
4. Verify each step with the recipes in **§19**.
5. Surface the gotchas in **§9** proactively so the user isn't surprised later.
6. Write a handoff doc (`AI_CONTEXT.md` at project root) so the next session has full state.
7. **Do not git commit** unless the user explicitly asks.

---

## 1. Scope and intent

### What this skill does

Adds a new Go module to an existing Go workspace whose only job is to:

- Open a native window with a WebView (WKWebView on macOS).
- Load the user's existing SPA from inside the binary (via Wails `assetserver` + `embed.FS`).
- Expose a single Go method (`App.HTTP`) to the JavaScript runtime via the Wails IPC bridge.
- Run the user's existing Gin engine in memory and dispatch every bridge call through `engine.ServeHTTP(httptest.NewRecorder(), req)`.

Result: a single signed `.app` (macOS) that contains the full backend stack + frontend, with no inbound TCP listener of any kind. Existing production HTTP server binary remains buildable and unchanged.

### What this skill does NOT do

- Greenfield project scaffolding — for a brand-new Wails app, just run `wails init` directly; this skill is the integration recipe.
- Backend rewrites — does not refactor gqlgen schemas, oRPC routers, ent models, plugins, middleware, etc.
- Frontend client rewrites — does not migrate Apollo → urql, oRPC → tRPC, etc.
- Production deployment automation — bundling, code signing, notarization, auto-update, app store submission are downstream concerns documented at **§17** but not orchestrated here.
- Multi-platform parity — primarily targets macOS in this version; Windows/Linux notes in **§15**.
- Streaming responses — the default bridge buffers responses; the streaming workaround is sketched in **§10** but not auto-applied.

### Why this exact shape (not a thinner one)

The "frontend lives in the browser" assumption is what creates the port problem. The "frontend lives in a WebView we control" assumption dissolves it — no URL bar, no Origin to fight, no shareable port number to type. The "use HTTP-shaped IPC" decision means the existing backend (designed for HTTP) and existing frontend clients (designed for HTTP) both work unchanged. Anything more ambitious (custom RPC, bridge-only protocols) trades the rewrite cost.

---

## 2. When to invoke this skill

Invoke when the user says any of:

- "package this app as a desktop binary"
- "wrap our Go API + React frontend in Wails"
- "make a `.app` out of our backend + frontend"
- "ship the SaaS as a desktop app"
- "turn this into a native app with no port"
- "embed our Gin server inside a WKWebView app"
- `/ubgo-wails-desktop`

**Do NOT invoke when:**

- The user wants a brand-new app from scratch — `wails init` directly suffices.
- The backend is not an `http.Handler`-based framework (Gin / Echo / chi / Fiber / std lib all qualify). If they use net/rpc, twirp without an HTTP adapter, etc., the `engine.ServeHTTP` trick doesn't apply.
- The frontend has no build step (plain static HTML) — the IPC trick still works but the Vite/TanStack pipeline doesn't apply; adapt manually.
- The user is already on Tauri / Electron / Neutralino — they have a different bridge model; this skill is Wails-specific.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ <name>.app  /  /tmp/<name>-desktop   (single Mach-O arm64, ~100MB)   │
│                                                                      │
│  ┌─────────────────────────────┐                                     │
│  │ Wails native window         │                                     │
│  │  ╭───────────────────────╮  │                                     │
│  │  │  WKWebView            │  │  ←─── built into macOS, ~zero       │
│  │  │  origin: wails://     │  │       binary cost (system framework)│
│  │  │  loads index.html     │  │                                     │
│  │  │  from embed.FS via    │  │                                     │
│  │  │  Wails assetserver    │  │                                     │
│  │  │                       │  │                                     │
│  │  │  React / Vite / TS    │  │                                     │
│  │  │  bundle running here  │  │                                     │
│  │  │                       │  │                                     │
│  │  │  bridgeFetch(url, …) ─┼──┼───┐                                 │
│  │  ╰───────────────────────╯  │   │                                 │
│  └─────────────────────────────┘   │                                 │
│                                    │ webkit.messageHandlers          │
│                                    │   postMessage                   │
│                                    ▼                                 │
│  ┌────────────────────────────────────────────────────────┐          │
│  │ Wails runtime (Go side)                                │          │
│  │   - JSON marshal of {method, path, headers, bodyB64}   │          │
│  │   - dispatch to bound method by name (App.HTTP)        │          │
│  └─────────────────┬──────────────────────────────────────┘          │
│                    ▼                                                 │
│  ┌────────────────────────────────────────────────────────┐          │
│  │ func (a *App) HTTP(...)                                │          │
│  │   1. base64 decode body                                │          │
│  │   2. http.NewRequestWithContext(ctx, method, path,…)   │          │
│  │   3. headers → req.Header.Add                          │          │
│  │   4. httptest.NewRecorder()                            │          │
│  │   5. a.engine.ServeHTTP(rec, req)  ◀── here be magic   │          │
│  │   6. read rec.Body                                     │          │
│  │   7. return {Status, Headers, Body (b64)}              │          │
│  └─────────────────┬──────────────────────────────────────┘          │
│                    ▼                                                 │
│  ┌────────────────────────────────────────────────────────┐          │
│  │ EXISTING Gin engine (built by apiboot.Build)           │          │
│  │   - CORS, OTEL, internal-key, request-id middlewares   │          │
│  │   - /api/dash/query (gqlgen)                           │          │
│  │   - /api/dash/query_playground                         │          │
│  │   - /api/dash/gql (playground UI)                      │          │
│  │   - /api/version, /api/ping, /api/i/*                  │          │
│  │   - /api/app_test (apphandlers)                        │          │
│  │   - /api/orpc/*, /api/trpc/*                           │          │
│  │   - any other route the existing server registered     │          │
│  └────────────────────────────────────────────────────────┘          │
│                                                                      │
│  Outbound TCP (data layer only):                                     │
│    - 127.0.0.1:6379  (Redis)                                         │
│    - [::1]:5432      (Postgres via ent — possibly two for pim)       │
│    - whatever NATS / S3 / OTEL collector you configured              │
│                                                                      │
│  Inbound TCP: NONE. lsof -iTCP -sTCP:LISTEN returns empty.           │
│  Inbound UDP: NONE.                                                  │
│  Unix sockets: ONE or TWO anonymous socketpair entries (internal     │
│                IPC with WKWebView XPC subprocesses — not a server).  │
└──────────────────────────────────────────────────────────────────────┘
```

### Key insight

**Gin's router is just an `http.Handler`.** It does not care whether bytes arrived from a TCP socket or from a function call. We feed it function calls.

`httptest.NewRecorder()` is a stdlib `http.ResponseWriter` implementation that buffers everything into an in-memory `ResponseRecorder`. Pair that with an `*http.Request` constructed via `http.NewRequest`, and you can run any HTTP handler chain without involving the network stack at all.

This is the same pattern stdlib uses internally for `httptest.NewServer` — Wails just lets you skip the server step.

### Why "HTTP-shaped IPC" beats alternatives

| Alternative | Problem |
|---|---|
| Bridge ONE gqlgen executor via `window.go.api.Query` | Rewrites every oRPC / tRPC client call site. Multi-day frontend churn. Loses HTTP middleware semantics (cookies, OTEL headers, auth). |
| Loopback HTTP server inside the binary | One TCP listener inside the process. Visible to `lsof`. Firewalls in some corp environments block loopback. User explicitly didn't want this. |
| Custom URL scheme handler (`<name>://`) for assets + API | Significant per-OS CGO. Possible but expensive. Better target for v2 if zero-network surface is required. |
| Two binaries (Go API as sidecar, frontend in a thin shell) | Two processes, IPC plumbing, not "single binary". Sidecar pattern is fine for tools, not for shipping. |
| Electron with the Go API as a child process | Adds ~120 MB Chromium per app. Doesn't solve the API transport problem. Architecturally heavier than Wails. |

---

## 4. What to ask the user up front

Use `AskUserQuestion` or plain prose. Capture answers; substitute into the `<placeholder>` variables throughout §7 and §22.

### Required answers

1. **`<backend-path>`** — absolute path to the Go backend root. Should contain `go.mod` or `go.work`.
2. **`<frontend-path>`** — absolute path to the frontend repo. Often a sibling of the backend, but may live anywhere.
3. **`<api-cmd-main>`** — path to the current `package main` file that constructs the Gin engine (e.g. `saas/cmd/api/main.go`).
4. **`<api-module-name>`** — the Go module name that owns the api cmd (e.g. `saas`).
5. **`<name>`** — short app name (lowercase, no spaces, e.g. `sync`). Used for binary filename, log path, etc.
6. **`<display-name>`** — what shows in the macOS title bar (e.g. `Sync`).
7. **`<bundle-id>`** — reverse-DNS identifier (e.g. `dev.khanakia.sync`). Required for code signing later.

### Strongly recommended answers

8. **`<frontend-framework>`** — TanStack Start? Plain Vite? Next.js? SvelteKit? Astro? See **§7.7** for build-output paths per framework.
9. **`<frontend-build-output>`** — directory the frontend's `pnpm build` (or equivalent) writes to. Detected from framework but verify.
10. **`<frontend-html-entry>`** — name of the SPA entry HTML. Default `index.html`; TanStack Start emits `_shell.html` (rename required).
11. **HTTP clients in use** — oRPC, tRPC, Apollo, urql, Relay, raw `fetch`, axios. Drives **§7.10**.
12. **Streaming responses anywhere?** — SSE, NDJSON, gRPC-Web, tRPC's `httpBatchStreamLink`, Server Components RSC. If yes, surface **§10** before promising "done".
13. **`<env-file>`** — path to `.env` with DB/Redis/NATS credentials. Needed at launch so the engine can connect.
14. **`<output-binary-path>`** — where to write the built binary. Default `/tmp/<name>-desktop`.

### Defaults to apply if no answer

| Variable | Default |
|---|---|
| `<name>` | `desktop` |
| `<display-name>` | Inferred Title-Case from `<name>` |
| `<bundle-id>` | `dev.local.<name>` |
| `<output-binary-path>` | `/tmp/<name>-desktop` |
| `<frontend-framework>` | Detect from `package.json` (look for `@tanstack/react-start`, `vite`, `next`, `@sveltejs/kit`, etc.) |

Tell the user when you default; do not silently assume.

---

## 5. Reconnaissance procedure

Before writing any code, gather facts. Use these exact commands.

### 5.1 Backend recon

```bash
# Workspace layout
cd <backend-path>
ls -la
cat go.work 2>/dev/null || cat go.mod
find . -maxdepth 4 -name "main.go" -not -path "*/vendor/*" -not -path "*/node_modules/*"

# Identify the API cmd
ls <api-cmd-main>
head -50 <api-cmd-main>

# Find where the Gin engine is constructed
grep -rn "gin.Default\|gin.New\|ginserver.New\|fiber.New\|echo.New" --include="*.go" \
  -l 2>&1 | grep -v vendor | head -5

# Identify the route registration helpers (apidash, coreapi, apphandlers — names vary)
grep -rn "Boot(" --include="*.go" <backend-path> | grep -v vendor | head -10

# Plugin / DB / config boot
grep -rn "config.Get\|app.New\|plugin.New\|ent.NewClient" --include="*.go" \
  <backend-path>/<api-module-name>/cmd | head -10

# Any vendor directory?
ls <backend-path>/vendor 2>/dev/null && echo "VENDOR PRESENT" || echo "no vendor"
```

What to extract:

- The exact line where the engine is constructed (Gin? `ginserver.New(...)`? Echo?).
- The pattern for wiring routes (function-style `Boot(group, resolver)`, builder pattern, etc.).
- Plugins / globals initialised at boot.
- Anything that depends on **CWD** (file-system config loaders are common — these will break in `.app` launches).
- Whether the backend has `vendor/` (controls whether `go work vendor` regeneration is needed).

### 5.2 Frontend recon

```bash
cd <frontend-path>
cat package.json | head -50
ls src
cat vite.config.ts 2>/dev/null || cat next.config.* 2>/dev/null || cat svelte.config.* 2>/dev/null

# Identify HTTP clients
grep -rn "createClient\|createTRPCClient\|httpLink\|httpBatchLink\|httpBatchStreamLink\|RPCLink\|fetch(" \
  --include="*.ts" --include="*.tsx" src | grep -v node_modules | head -30

# Detect existing build output
ls .output 2>/dev/null   # TanStack Start
ls dist 2>/dev/null      # Plain Vite, Astro
ls out 2>/dev/null       # Next.js static export
ls build 2>/dev/null     # SvelteKit static
```

What to extract:

- Build output directory.
- HTML entry filename.
- Every place that constructs an HTTP client (each needs the `fetch: bridgeFetch` swap in **§7.10**).
- Whether any client uses streaming (`httpBatchStreamLink` from tRPC is the big one).

### 5.3 Wails / toolchain recon

```bash
which wails
wails version    # 2.8.1 is what this skill targets
go version       # >= 1.21 minimum, 1.22+ for `go work vendor`
which pnpm node
xcode-select -p  # macOS: need Xcode CLI tools for CGO
```

If `wails` is missing: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`. If `xcode-select` not configured: `xcode-select --install` (interactive prompt).

---

## 6. Mental model — every layer

Once before writing code, internalize what each piece does.

### 6.1 The "loaded SPA" layer

Wails serves your SPA from `embed.FS` via its `assetserver`. The WebView fetches `wails://wails/index.html`. From the React app's perspective, the page origin is `wails://wails` — that's what `window.location.origin` returns, and what `fetch("/foo")` resolves against. This origin is **not a real network URL**; Wails intercepts asset requests and serves them straight from the embedded filesystem (no port, no socket).

If a frontend uses absolute URLs like `https://api.example.com/foo`, those would normally trigger a real HTTPS request from the WebView. The browser **does not know about Wails bindings unless we route through them**. That's where bridgeFetch comes in.

### 6.2 The bridgeFetch shim

```
Frontend code
   │ calls bridgeFetch("/api/foo", { method, headers, body })
   ▼
bridgeFetch.ts
   │ if Wails NOT available (running in a real browser dev shell):
   │   return platform fetch(...)            ← graceful fallback
   │ else:
   │   serialize headers, base64 body
   │   console.log the request (visible in inspector Console)
   │   call window.go.main.App.HTTP(method, path, headers, bodyB64)
   ▼
Wails runtime layer (browser side)
   │ JSON-stringifies the call payload
   │ postMessage to webkit.messageHandlers.external
   ▼
Wails runtime layer (Go side)
   │ matches bound method by name → "App.HTTP"
   │ JSON-unmarshals args → (string, string, map[string][]string, string)
   ▼
Your App.HTTP method
   │ base64-decode body
   │ http.NewRequestWithContext(ctx, method, path, body)
   │ inject headers
   │ httptest.NewRecorder()
   │ engine.ServeHTTP(rec, req)
   │ read rec.Body
   │ return HTTPResponse{Status, Headers, Body (b64), Error}
   ▼
Wails runtime
   │ JSON-marshal return value
   │ evaluateJavaScript("window.runtime.callback(..., ...)")
   ▼
bridgeFetch.ts (promise resolution)
   │ base64-decode body
   │ construct a real Response object
   │ console.log the response
   ▼
Caller receives Response { status, headers, ok, text(), json(), ... }
```

The shim's job is to make this round-trip look exactly like a real `fetch` call from the React side. Apollo, urql, oRPC, tRPC all accept a custom `fetch:` option and don't care what's happening inside.

### 6.3 The Gin engine

The engine your existing `cmd/api/main.go` builds today. **All** middleware, route registrations, gqlgen schemas, ent integrations, NATS publishers stay exactly as they are. `apiboot.Build()` is the extraction point — same function gets called by both the existing HTTP server (which then calls `Start()`) and the new Wails shell (which doesn't).

### 6.4 WKWebView subprocesses

On macOS, WKWebView spawns shared XPC services:

- `com.apple.WebKit.WebContent.xpc` — renders HTML / runs JS
- `com.apple.WebKit.Networking.xpc` — handles network requests for normal HTTP (NOT bridge calls)
- `com.apple.WebKit.GPU.xpc` — Metal compositing

These are **system-wide singletons** — your app does not "spawn" them in the cost sense; they're already running in your user session. Memory is shared with Safari and every other WKWebView app on your machine.

Your Wails process owns the window + the Go runtime + the embedded assets. The actual rendering happens in `WebContent.xpc`. Bridge calls hop from `WebContent` → your process via Mach IPC, then your Go code runs.

---

## 7. Step-by-step execution

Run these phases in order. Verify each before moving on.

### 7.1 Extract engine builder from existing `cmd/api/main.go`

Read the existing `<api-cmd-main>` end-to-end. Identify:

- The config loader call (e.g. `config.Get()`), if any.
- The plugin / app constructor (e.g. `app.New(...)`), if any.
- The middleware list, if any.
- The Gin server construction (vanilla `gin.Default()` OR a wrapper like `ginserver.New(...)`).
- All `*.Boot(...)` / `*.New(...)` calls that register routes.
- The shutdown / start sequence.

Create a new package: `<backend-path>/<api-module-name>/pkg/apiboot/apiboot.go` (or `<backend-path>/apiboot/` for single-module backends where the path is shallower).

Pick the variant that matches the existing code's complexity.

#### Variant A — Minimal: vanilla Gin, no plugins, no shutdown library

If the existing `main.go` is roughly:

```go
func main() {
    r := gin.Default()
    r.GET("/api/hello", ...)
    r.Run(":7711")
}
```

Then the extraction is trivial:

```go
package apiboot

import "github.com/gin-gonic/gin"

type Boot struct {
    Engine *gin.Engine
}

func Build() Boot {
    r := gin.Default()
    r.GET("/api/hello", func(c *gin.Context) { /* … */ })
    r.GET("/api/time",  func(c *gin.Context) { /* … */ })
    return Boot{Engine: r}
}
```

The original `main.go` becomes:

```go
package main

import "<api-module-name>/apiboot"

func main() {
    apiboot.Build().Engine.Run(":7711")
}
```

Both binaries — existing API server + new Wails shell — compile clean.

#### Variant B — Rich: plugins, middlewares, custom Gin wrapper, shutdown library

For projects with `ginserver`, plugin systems, ent DB clients, NATS, OTEL, etc.:

```go
package apiboot

import (
    // copy ALL imports from the original main.go EXCEPT
    // the ones only used by shutdown.New(...) / Start()
    "<all-the-existing-imports>"

    "github.com/gin-gonic/gin"
)

// Boot exposes everything the desktop shell needs to dispatch in-memory:
// the live engine, the server (for Shutdown), and the constructed plugins.
type Boot struct {
    Server  ginserver.Server // exposes Start / Shutdown
    Engine  *gin.Engine      // == Server.Router
    Plugins *app.CustomApp   // whatever type app.New returns; check the existing code
}

// Build replicates the wiring previously inline in <api-cmd-main>.
// Behavior is identical to the original; this is a pure refactor.
func Build() Boot {
    // ... exact same code as the original main(), up to but not including
    //     defer shutdown.New(...).Listen() and go serverServer.Start()
    return Boot{
        Server:  serverServer,
        Engine:  serverServer.Router,
        Plugins: plugins,
    }
}
```

**Important:** the type of `Plugins` is whatever the original code's `app.New(...)` returns. Don't assume `*plugin.Plugin` — verify against the source. In the reference integration it was `*app.CustomApp`.

#### How to choose

- Original `main.go` is < 30 lines, no `app.New` / `plugin` / `shutdown.New` calls → **Variant A**.
- Original `main.go` is > 30 lines OR pulls in custom wrappers / plugins / shutdown libs → **Variant B**.

When in doubt, start with Variant A (simpler struct) and add fields as the desktop module turns out to need them.

Now rewrite `<api-cmd-main>` to use the new helper:

```go
package main

import (
    "context"

    "core/pkg/plugin"
    "lace/gozap"
    "lace/shutdown"
    "<api-module-name>/pkg/apiboot"

    "go.uber.org/zap"
)

func main() {
    boot := apiboot.Build()

    defer shutdown.New(
        shutdown.WithMsgShuttingDown("Shutting down API..."),
        shutdown.WithMsgShutdownCompleted("API stopped."),
        shutdown.WithMsgShutdownFailed("Error shutting down API"),
        shutdown.WithLogger(gozap.GetLogger()),
        shutdown.WithShutdownHandler(plugin.ShutdownHandler, func(ctx context.Context) error {
            if err := boot.Server.Shutdown(ctx); err != nil {
                gozap.FromCtx(ctx).Error("HTTP server shutdown failed", zap.Error(err))
                return err
            }
            return nil
        }),
    ).Listen()

    go boot.Server.Start()
}
```

Adjust to match the user's existing shutdown hook shape exactly. If they use a different shutdown library, keep their library; only the boot half is extracted.

**Verify:** `go build ./<api-module-name>/cmd/api` should still succeed and produce a working binary. This is a pure refactor — no semantic change. If a behavioral diff sneaks in, back out.

### 7.2 Scaffold the desktop module

**Preferred: hand-scaffold** the four required files directly. `wails init` is known broken on Go workspaces (§9.1) and produces a frontend scaffold that gets immediately deleted in §7.9 anyway. Hand-scaffolding is faster, deterministic, and works in both workspace and single-module setups.

```bash
mkdir -p <backend-path>/desktop/frontend/dist
mkdir -p <backend-path>/desktop/build
cd <backend-path>/desktop
# Write go.mod, main.go, app.go, wails.json from §7.4–§7.7 templates.
# go.sum is generated by `go mod tidy` after the imports are in place.
```

**Alternative: `wails init`** — only do this if you specifically want the Wails CLI's scaffold to compare against. Note that it will:
- Set `go 1.21` in go.mod (you'll need to bump it).
- Create a tiny Vite frontend that we discard.
- Write a `wails.json` that runs `npm install` + `npm run build` (we override in §7.7).

```bash
cd <backend-path>
wails init -n desktop -t vanilla -d desktop
```

Either way, the next step is identical: write the files in §7.4–§7.7. Hand-scaffolding skips having to delete or overwrite the CLI's outputs.

### 7.3 Add to go.work (workspace projects ONLY — skip for single-module backends)

**Decision point:** check whether `<backend-path>/go.work` exists.

- **No `go.work` (single Go module):** skip this entire section. The `replace <api-module-name> => ../<relative-path>` directive in `desktop/go.mod` (§7.4) is the equivalent dependency-resolution mechanism.
- **`go.work` exists (multi-module workspace):** apply the diff below.

```diff
 use (
     ./apidash
     ./config
     ./core
     ./dbent
+    ./desktop
     ./examples
     ./lace
     ./pim
     ./saas
     ./scripts
 )
```

(Module list varies per project — preserve the existing list and just add `./desktop`.)

After this edit, `cd <backend-path> && go build ./desktop` should resolve all imports.

### 7.4 Update `desktop/go.mod`

```
module desktop

go 1.26.1   ← match the workspace's Go version

require (
    github.com/gin-gonic/gin v1.12.0
    github.com/wailsapp/wails/v2 v2.8.1
    <api-module-name> v0.0.0-00010101000000-000000000000
)

replace <api-module-name> => ../<api-module-name>
```

Reasoning for each line:
- `go 1.26.1` — Wails scaffold defaults to `1.21`; the workspace probably uses a newer version. Mismatch causes vendor errors.
- `gin-gonic/gin` — direct require because `app.go` imports `*gin.Engine` for its struct field.
- `wails/v2` — the only thing the scaffold added.
- `<api-module-name>` — pulled in transitively, but listed explicitly so it's obvious in the diff.
- `replace ... => ../...` — required because Go-modules-without-workspace mode looks up the version remotely; the local path resolves it.

### 7.5 Replace the scaffold's `app.go`

```go
package main

import (
    "bytes"
    "context"
    "encoding/base64"
    "io"
    "net/http"
    "net/http/httptest"

    "<api-module-name>/pkg/apiboot"

    "github.com/gin-gonic/gin"
)

// App is the single Wails-bound type. Its only public method is HTTP, which
// receives request data from the frontend's bridgeFetch shim, runs it through
// the existing Gin engine in-memory (no socket), and returns the response.
type App struct {
    ctx    context.Context
    engine *gin.Engine
}

func NewApp() *App { return &App{} }

// startup is invoked by Wails once the WebView is ready. We build the same
// engine the production HTTP server would have built — same middlewares,
// same plugins, same gqlgen schema — and hold a reference so HTTP can dispatch.
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    boot := apiboot.Build()
    a.engine = boot.Engine
}

// HTTPResponse is the wire shape returned to the frontend's bridgeFetch.
// Field names are short to minimise the JSON payload per call.
type HTTPResponse struct {
    Status  int                 `json:"status"`
    Headers map[string][]string `json:"headers"`
    Body    string              `json:"body"` // base64-encoded
    Error   string              `json:"error,omitempty"`
}

// HTTP synchronously dispatches one frontend request through the Gin engine.
// `body` is base64-encoded so binary payloads survive the IPC channel.
//
// IMPORTANT: do NOT touch this method's signature. Wails generates TS bindings
// from the parameter types; widening or narrowing them changes the JS API.
func (a *App) HTTP(method, path string, headers map[string][]string, body string) HTTPResponse {
    rawBody, err := base64.StdEncoding.DecodeString(body)
    if err != nil {
        return HTTPResponse{Error: "decode body: " + err.Error()}
    }

    req, err := http.NewRequestWithContext(a.ctx, method, path, bytes.NewReader(rawBody))
    if err != nil {
        return HTTPResponse{Error: err.Error()}
    }
    for k, vs := range headers {
        for _, v := range vs {
            req.Header.Add(k, v)
        }
    }

    rec := httptest.NewRecorder()
    a.engine.ServeHTTP(rec, req)

    res := rec.Result()
    respBody, _ := io.ReadAll(res.Body)
    return HTTPResponse{
        Status:  res.StatusCode,
        Headers: res.Header,
        Body:    base64.StdEncoding.EncodeToString(respBody),
    }
}
```

### 7.6 Update `desktop/main.go`

```go
package main

import (
    "embed"

    "github.com/wailsapp/wails/v2"
    "github.com/wailsapp/wails/v2/pkg/options"
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
    app := NewApp()
    err := wails.Run(&options.App{
        Title:  "<display-name>",
        Width:  1400,
        Height: 900,
        AssetServer: &assetserver.Options{Assets: assets},
        BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
        OnStartup: app.startup,
        Bind: []interface{}{app},
        Debug: options.Debug{
            // Auto-opens the Safari Web Inspector at startup. Requires the
            // `debug devtools` build tags (see §7.11) — without them Wails
            // strips the inspector code in production builds.
            OpenInspectorOnStartup: true,
        },
    })
    if err != nil { println("Error:", err.Error()) }
}
```

### 7.7 Configure `wails.json` to skip frontend build steps

We control the frontend build via the frontend repo's pnpm pipeline; Wails should not try to `npm install` or `npm run build` in its scaffold's frontend dir.

```json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "desktop",
  "outputfilename": "desktop",
  "frontend:install": "true",
  "frontend:build": "true",
  "frontend:dev:watcher": "true",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "<user-name>",
    "email": "<user-email>"
  }
}
```

`true` is a shell no-op (always exits 0). Wails calls these commands as part of `wails build` / `wails dev`, but in our flow we bypass `wails build` (see §9.1) so these only matter if someone runs the Wails CLI later.

### 7.8 Build the frontend SPA

Build output paths per framework (verify against the actual project):

| Framework | Build command | Output dir | HTML entry |
|---|---|---|---|
| **TanStack Start** (`tanstackStart({spa:{enabled:true}})`) | `pnpm build` | `.output/public/` | **`_shell.html`** ⚠ rename to `index.html` |
| **Plain Vite** | `pnpm build` | `dist/` | `index.html` |
| **Next.js** (`output: 'export'`) | `pnpm build` then `pnpm next export` | `out/` | `index.html` |
| **Astro** (no SSR) | `pnpm build` | `dist/` | `index.html` |
| **SvelteKit** (`@sveltejs/adapter-static`) | `pnpm build` | `build/` | `index.html` |
| **Solid Start** (`presets.staticSite`) | `pnpm build` | `dist/public/` | `index.html` |

Run the build:

```bash
cd <frontend-path>
pnpm install   # first time only
pnpm build
```

**Verify** the expected output dir + HTML entry exist before continuing. If TanStack Start, confirm `_shell.html` is present (NOT `index.html`).

### 7.9 Copy frontend into the desktop module + rename if needed

```bash
# Use /bin/rm to bypass any `rm -i` shell alias (common in zsh).
/bin/rm -rf <backend-path>/desktop/frontend/dist
mkdir -p <backend-path>/desktop/frontend/dist

# Trailing /. on src reliably copies contents (incl. hidden files) into dst.
# More robust than /* which can choke on edge-case shells / empty dirs.
cp -R <frontend-path>/<frontend-build-output>/. \
      <backend-path>/desktop/frontend/dist/

# Strip macOS metadata noise from the embedded bundle.
find <backend-path>/desktop/frontend/dist -name '.DS_Store' -delete

# TanStack Start only — rename SPA shell to index.html
if [ -f <backend-path>/desktop/frontend/dist/_shell.html ]; then
    mv <backend-path>/desktop/frontend/dist/_shell.html \
       <backend-path>/desktop/frontend/dist/index.html
fi
```

### 7.10 Add `bridgeFetch.ts` to the frontend repo

Path: `<frontend-path>/src/lib/bridgeFetch.ts` (or wherever utilities live in the project).

```ts
// bridgeFetch — a fetch-compatible wrapper that routes every HTTP-shaped
// request through the Wails IPC bridge. The desktop Wails binary runs the
// existing Gin engine in-memory via httptest.NewRecorder, so requests never
// hit a TCP socket. Outside of the desktop binary (regular browser dev) this
// falls back to the platform fetch so the same code works in a normal SPA.

type WailsHTTPResponse = {
    status: number
    headers: Record<string, string[]>
    body: string
    error?: string
}

type WailsBridge = {
    go?: {
        main?: {
            App?: {
                HTTP?: (
                    method: string,
                    path: string,
                    headers: Record<string, string[]>,
                    body: string,
                ) => Promise<WailsHTTPResponse>
            }
        }
    }
}

const utf8ToBase64 = (s: string): string =>
    btoa(unescape(encodeURIComponent(s)))

const base64ToUtf8 = (s: string): string =>
    decodeURIComponent(escape(atob(s)))

const isWailsAvailable = (): boolean => {
    if (typeof window === "undefined") return false
    const w = window as unknown as WailsBridge
    return typeof w.go?.main?.App?.HTTP === "function"
}

async function readBodyAsString(body: BodyInit | null | undefined): Promise<string> {
    if (body == null) return ""
    if (typeof body === "string") return body
    const arr = await new Response(body as BodyInit).arrayBuffer()
    return new TextDecoder().decode(arr)
}

export const bridgeFetch: typeof fetch = async (input, init = {}) => {
    if (!isWailsAvailable()) {
        console.debug("[bridgeFetch] platform fetch fallback", { input })
        return fetch(input as RequestInfo, init)
    }

    const url =
        typeof input === "string"
            ? input
            : input instanceof URL
                ? input.toString()
                : (input as Request).url
    const method = (init.method ?? "GET").toUpperCase()

    const headers: Record<string, string[]> = {}
    new Headers(init.headers ?? {}).forEach((value, key) => {
        const k = key.toLowerCase()
        if (!headers[k]) headers[k] = []
        headers[k].push(value)
    })

    const bodyStr = await readBodyAsString(init.body)

    console.log(
        `%c[bridgeFetch] → ${method} ${url}`,
        "color:#06b6d4;font-weight:bold",
        { headers, bodyLen: bodyStr.length },
    )
    const t0 = performance.now()

    const w = window as unknown as WailsBridge
    const HTTP = w.go!.main!.App!.HTTP!
    const res = await HTTP(method, url, headers, utf8ToBase64(bodyStr))

    const ms = (performance.now() - t0).toFixed(1)
    console.log(
        `%c[bridgeFetch] ← ${res.status} ${url}  (${ms}ms)`,
        "color:#22c55e",
        { headers: res.headers, bodyLen: res.body?.length ?? 0, error: res.error },
    )

    if (res.error) throw new Error(`bridgeFetch: ${res.error}`)

    const respHeaders = new Headers()
    for (const [k, vs] of Object.entries(res.headers ?? {})) {
        for (const v of vs) respHeaders.append(k, v)
    }

    return new Response(base64ToUtf8(res.body ?? ""), {
        status: res.status,
        headers: respHeaders,
    })
}
```

Notes:

- The `console.log` lines are intentional — bridge calls don't appear in the Network tab (see §9.4), so console is the primary visibility. Acceptable in production for now; suppress later via a build-time flag if noise is unacceptable.
- The `isWailsAvailable` fallback lets the same code work in normal browser dev (running `pnpm dev` in the frontend repo against the real API at `https://your.localhost`). Critical for not breaking the existing dev loop.
- `btoa(unescape(encodeURIComponent(...)))` is the classic UTF-8-safe base64 trick. Strict TS configs may complain that `escape` / `unescape` are deprecated. They still work in every browser — silence the warning with `// @ts-expect-error` or use the modern variant below.

Modern UTF-8 safe base64 (if `escape`/`unescape` are forbidden):

```ts
const utf8ToBase64 = (s: string): string => {
    const bytes = new TextEncoder().encode(s)
    let bin = ""
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
}

const base64ToUtf8 = (s: string): string => {
    const bin = atob(s)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
}
```

Functionally identical; uses `TextEncoder`/`TextDecoder` (ES2017+, ubiquitous in modern WebViews).

### 7.11 Plug bridgeFetch into existing HTTP clients

Locate every HTTP client setup file. Common shapes:

#### oRPC (`@orpc/client/fetch`)

```ts
import { RPCLink } from "@orpc/client/fetch"
import { bridgeFetch } from "@/lib/bridgeFetch"

const orpcLink = new RPCLink({
    url: getOrpcUrl(),
    fetch: bridgeFetch,        // ← add this
})
```

#### tRPC (`@trpc/client`)

```ts
import { httpBatchStreamLink } from "@trpc/client"
import { bridgeFetch } from "@/lib/bridgeFetch"

const trpcClient = createTRPCClient<TRPCRouter>({
    links: [
        httpBatchStreamLink({
            transformer: superjson,
            url: getUrl(),
            fetch: bridgeFetch,    // ← add this
        }),
    ],
})
```

**Streaming caveat:** `httpBatchStreamLink` is a streaming link. The current bridge buffers responses (see **§10**), so streaming will appear "stuck". Either switch to `httpBatchLink` for now, or implement the streaming variant in §10 first.

#### Apollo (`@apollo/client`)

```ts
import { createHttpLink } from "@apollo/client"
import { bridgeFetch } from "@/lib/bridgeFetch"

const httpLink = createHttpLink({
    uri: API_URL,
    fetch: bridgeFetch,
})
```

#### urql

urql's `fetchExchange` doesn't accept a custom fetcher directly. Options:

1. Define a custom exchange that calls `bridgeFetch`.
2. Override `globalThis.fetch` before urql initializes (`globalThis.fetch = bridgeFetch`). Crude but works.

#### Raw `fetch` in code

```diff
- const res = await fetch(GRAPHQL_ENDPOINT, { ... })
+ import { bridgeFetch } from "@/lib/bridgeFetch"
+ const res = await bridgeFetch(GRAPHQL_ENDPOINT, { ... })
```

#### axios

axios bypasses `fetch` entirely. To route through the bridge:

```ts
import axios from "axios"
import { bridgeFetch } from "@/lib/bridgeFetch"

axios.defaults.adapter = async (config) => {
    const res = await bridgeFetch(config.url!, {
        method: config.method?.toUpperCase(),
        headers: config.headers as any,
        body: config.data ? JSON.stringify(config.data) : undefined,
    })
    return {
        data: await res.json(),
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        config,
        request: {},
    }
}
```

#### Sweep to make sure none were missed

```bash
cd <frontend-path>
grep -rn 'fetch\b' src/integrations src/lib src/api 2>/dev/null | grep -v 'bridgeFetch\|//.*fetch\|/\*.*fetch'
```

Anything that matches and isn't already routed needs attention.

### 7.12 URL handling rule

The `path` argument to `App.HTTP` accepts:

- **Absolute path** like `/api/dash/query` — preferred. Gin matches by path. Host is irrelevant.
- **Absolute URL** like `https://api.example.com/api/dash/query` — also works. Go's URL parser extracts `req.URL.Path = "/api/dash/query"`; Gin still matches.

So the existing frontend code with `import.meta.env.VITE_GRAPHQL_URL ?? "https://your.localhost/api/dash/query"` works unchanged. The bridge ignores host; Gin sees only the path.

You don't have to migrate to relative URLs. But doing so makes the code work in both desktop AND a normal-browser dev shell without env-switching, so consider it.

### 7.13 Refresh workspace vendor (only if `<backend>/vendor/` exists)

```bash
cd <backend-path>
go work vendor
```

Without this, `go build` will fail with `inconsistent vendoring` because the new desktop module added Wails-related deps that aren't in the existing `vendor/modules.txt`.

**Cost:** the vendor dir grows by ~6–10 MB (Wails + transitive deps). Hundreds of new files. Warn the user before running this; if their CI / git workflow relies on vendor diffs, this is a meaningful churn.

If vendor mode isn't used in the project, skip this step.

### 7.14 Build the desktop binary

```bash
cd <backend-path>
CGO_ENABLED=1 \
CGO_LDFLAGS="-framework UniformTypeIdentifiers" \
  go build -tags "desktop production debug devtools" -o <output-binary-path> ./desktop
```

Each flag explained:

| Flag | Why |
|---|---|
| `CGO_ENABLED=1` | Wails uses CGO for WKWebView wiring on macOS. Without CGO the build still links but the WebView won't initialize. |
| `CGO_LDFLAGS="-framework UniformTypeIdentifiers"` | **macOS-only.** macOS 11+ introduced `UTType` in this framework. WKWebView references it. Without this flag the linker errors: `Undefined symbols for architecture arm64: _OBJC_CLASS_$_UTType`. On Linux + Windows, **omit this flag entirely** (see §15). |
| `-tags desktop` | Wails uses this tag to select between desktop and CLI build paths. Without it the build aborts with: `Error: Wails applications will not build without the correct build tags`. |
| `-tags production` | Switches Wails from the dev runtime (which tries to connect to Vite at `frontend:dev:serverUrl`) to the production runtime (which serves from `embed.FS`). Without it, the binary tries to dial a dev server that doesn't exist. |
| `-tags debug` | Sets `IsDebug()` to `true`. This flips a runtime flag that enables the WKWebView Inspector and honors `Debug.OpenInspectorOnStartup`. Without it, the inspector is stripped from the binary even if you set the option. |
| `-tags devtools` | Sets `IsDevtoolsEnabled()` to `true`. Required by `Debug.OpenInspectorOnStartup`. Source: `vendor/github.com/wailsapp/wails/v2/internal/app/app_devtools.go`. |

If you want a "real production" build with NO inspector and NO debug logging, drop `debug devtools`. For development and the user's first integration, keep them.

Expected build time: 30–90 seconds depending on machine. Output binary size: **~30–100 MB** (varies wildly with backend complexity — minimal Gin + Wails is ~30 MB, rich stack with ent/gqlgen/oRPC/tRPC/NATS is ~100 MB; see §8).

**Benign warning to expect:** the linker emits:
```
WailsContext.m:164:18: warning: 'setShowsBaselineSeparator:' is deprecated:
first deprecated in macOS 15.0 - No longer supported
```
This is a known Wails v2.8.1 cosmetic issue against the macOS 15 SDK. Build still succeeds. Ignore.

### 7.15 Launch the binary

```bash
# Load env so the engine can connect to DB / Redis / NATS.
# Skip if backend has no env requirements.
[ -f "<env-file>" ] && { set -a; . <env-file>; set +a; }

# CWD note: if the backend has any path-walking config loader (see §9.2),
# you MUST `cd <backend-path>` before launching so the loader finds its
# files. If the backend has no CWD dependencies (vanilla single-module Gin,
# env-only config), the launch directory doesn't matter — we cd anyway for
# consistency and to keep the launch command identical across projects.
cd <backend-path>

# Run in background, detach
nohup <output-binary-path> >/tmp/<name>-desktop.log 2>&1 &
disown
PID=$!
echo "PID=$PID"
```

The Wails window opens. If `debug devtools` were in the tags, the Web Inspector window also opens.

### 7.16 Write the handoff doc

Create `<project-root>/AI_CONTEXT.md` summarizing:

- Goal + architecture
- Every file modified / created (full path + one-line purpose)
- The exact build + launch commands (§7.14 + §7.15)
- Known gotchas surfaced (§9)
- State at end of session

Template at the end of this skill (§24).

---

## 8. Empirical benchmarks

Measured against a real integration (sync_go backend + sync_tanstack frontend, 2026-05-26). Your numbers will vary but order-of-magnitude should match.

### 8.1 Binary size

```
Desktop binary (with embed.FS + Wails):    ~102 MB
Existing API server binary (no Wails):     ~93 MB
Wails-only overhead:                       ~9 MB  ← surprisingly small
Embedded frontend dist contribution:       ~3.5 MB
Vendor/wailsapp source size:               ~6.5 MB
```

Wails itself doesn't bundle Chromium — it uses system WKWebView, so the runtime cost is essentially the Go wrapper code. The 100 MB total is dominated by the existing Go code (Gin, gqlgen, ent, all transitive deps), not Wails.

### 8.2 Runtime memory

```
RSS (resident):     ~155 MB
VSZ (virtual):      ~449 GB    ← virtual address space, normal for Go
File descriptors:   ~59         (51 mmap'd files, 2 unix sockets, 2 pipes, IPv4/IPv6 TCP for DB/Redis, 1 systm, 1 KQUEUE, 1 IPv4, 1 DIR, 1 CHR)
CPU at idle:        5–8% (then drops to <1% once the WebView is settled)
```

WKWebView XPC subprocesses are **shared system-wide**, so they don't count against your app's RSS individually. They appear in `ps` as `com.apple.WebKit.WebContent`, `com.apple.WebKit.Networking`, `com.apple.WebKit.GPU` — these are shared with Safari and all other WKWebView apps.

### 8.3 Vendor directory growth

If the project vendors its deps, the desktop module adds ~6–10 MB of new vendored code (Wails + gin if not already vendored):

```
Before: vendor/ = ~70 MB
After:  vendor/ = ~82 MB (+12 MB)
```

Most of the diff is text source files for the Wails runtime + WebKit binding code.

### 8.4 IPC overhead per bridge call

Per call there's roughly:

- JSON marshal of the call payload (browser side, microseconds for small payloads)
- postMessage to webkit.messageHandlers (kernel hop, sub-millisecond)
- Go-side JSON unmarshal (microseconds)
- Your `App.HTTP` body runs (Gin's `ServeHTTP` cost — usually 1–10 ms for typical resolvers)
- Response: JSON marshal (Go side) → evaluateJavaScript (kernel hop) → resolve promise

Empirical round-trip for trivial endpoints (no DB): typically **5–15 ms**. For real GraphQL queries hitting Postgres: dominated by the query itself, IPC is ~1–2 ms.

### 8.5 Base64 body overhead

Bodies are base64-encoded to survive JSON-over-IPC reliably (raw binary in a JSON string field is unsafe). The size overhead is constant ~33% asymptotic:

```
Raw payload     Base64 size
100 bytes  →    136 bytes  (+36%)
1 KB       →    1.37 KB    (+33.3%)
10 KB      →    13.66 KB   (+33.3%)
100 KB     →    136.66 KB  (+33.3%)
1 MB       →    1.367 MB   (+33.3%)
```

For typical JSON API payloads (KB range), this is negligible. Avoid passing multi-MB binary downloads through the bridge — for those, expose a separate streaming bridge endpoint (see §10) or write to disk and pass a file path.

### 8.6 Build time

Cold build (empty Go module cache): **2–5 minutes**.
Incremental build (only desktop module touched): **~30 seconds**.
Frontend `pnpm build`: depends on framework — TanStack Start with Nitro is ~5–15 seconds for a moderate app.

---

## 9. Gotchas (every one we encountered)

### 9.1 Wails CLI is broken with Go workspaces

**Symptom:**
```
$ wails build
2026/05/26 01:24:02 internal error: package "bytes" without types was imported from "desktop"
```

**Cause:** Wails 2.8.1's TypeScript-binding generator uses an AST tool that doesn't grok `go.work`. It tries to load the `desktop` package's types and fails because the workspace has multiple modules.

**Workaround:** invoke `go build` directly with the flags from §7.14. Skip the Wails CLI entirely.

**Side effect:** TypeScript bindings under `<backend>/desktop/frontend/wailsjs/go/...` are not generated. The `bridgeFetch.ts` in §7.10 uses runtime type-checks (`as unknown as WailsBridge`), so it doesn't need them. If TS-typed bindings are wanted, run `wails generate module` separately (also fails on workspaces) or upgrade to Wails v2.10+ if available.

**Permanent fix (when feasible):** upgrade Wails. v2.10+ reportedly handles workspaces. As of this writing v2.8.1 is the latest stable in many distributions.

### 9.2 `config.Get()` (or any path-walking config loader) breaks when launched from `/`

**Symptom:**
```
panic: directory 'config' not found within 3 levels from /Users/.../
```

**Cause:** Many Go projects (and this skill's reference codebase) have config loaders that walk up from CWD looking for a `./config/` directory. When the macOS `.app` is double-clicked, CWD is `/`. The loader walks all the way up to `/`, can't find `config/`, panics.

**Fix paths** (recommend the simplest the user accepts):

1. **Embed config via `go:embed`** if it's static.
   ```go
   //go:embed all:config
   var configFS embed.FS
   ```
2. **Read entirely from env vars** (industry standard for distributed apps).
3. **Change the loader to use the executable's directory:**
   ```go
   exe, _ := os.Executable()
   configRoot := filepath.Join(filepath.Dir(exe), "config")
   ```
4. **Bundle config inside the `.app`'s `Contents/Resources/`** and set CWD before launch (uglier).

**Test workaround:** `cd <backend>` before launching. Works during dev, not for distribution.

### 9.3 TanStack Start emits `_shell.html`, not `index.html`

**Symptom:** Wails asset server returns 404 for `/index.html`. White window.

**Cause:** `tanstackStart({ spa: { enabled: true } })` produces an SPA shell named `_shell.html`. Wails expects `index.html` by default.

**Fix:** rename during copy (§7.9). One line.

**Cleaner fix (if TanStack ever exposes the option):** configure the plugin to emit `index.html`. As of this writing, no documented option exists; the rename in the build script is the established workaround.

### 9.4 The Network tab will NEVER show bridge calls

**Symptom:** "I see no requests in the Web Inspector's Network tab."

**Cause:** Bridge calls travel via `webkit.messageHandlers` postMessage, NOT HTTP. The browser does not consider them network traffic. The Network tab only shows:

- Initial page navigation (`wails://wails/index.html`)
- Resource loads (JS, CSS, images from `embed.FS`)
- Any real `fetch()` calls (which we've replaced with bridge calls)

**This is expected, not a bug.** Same as Electron's `ipcRenderer.invoke` — invisible to Network.

**Verification paths:**

1. **Console tab** — `bridgeFetch.ts` already logs every call:
   ```
   [bridgeFetch] → POST /api/dash/query    { headers, bodyLen: 142 }
   [bridgeFetch] ← 200 /api/dash/query    (12.3ms)
   ```
2. **Gin log on the Go side:**
   ```bash
   tail -f /tmp/<name>-desktop.log | grep '\[GIN\]'
   ```
3. **Breakpoint in `runtime.js`** (Wails-injected). Open Sources tab → find `runtime.js` → set breakpoint on `external.invoke` calls.

Tell the user this up front. Don't let them think the integration is broken.

### 9.5 Streaming responses break

**Symptom:** SSE / NDJSON / tRPC streaming endpoints "hang" — the response only arrives when the server closes the connection, all at once.

**Cause:** `httptest.NewRecorder()` buffers the entire response into memory before `Result()` returns. There's no incremental flush.

**Affected libraries:**

- tRPC's `httpBatchStreamLink` — most common gotcha
- SSE via `EventSource`
- Server Components RSC (only relevant if frontend uses RSC)
- gRPC-Web (only if used)
- Any custom NDJSON / chunked response

**Workarounds:**

1. **Use non-streaming variants where possible.** `httpBatchLink` instead of `httpBatchStreamLink`. The frontend code is the same; just slower for many-RPC pages.
2. **Implement a streaming bridge variant** (see §10).
3. **Avoid streaming endpoints entirely** in the desktop build. Gate them at the API level.

Ask the user about streaming **before** §7.11. If they need it, plan §10 first.

### 9.6 Wails v2.8.1 has a SMALLER `mac.Options` surface than docs suggest

**Symptom:**
```
desktop/main.go:43:4: unknown field DisableWebViewDragAndDrop in struct literal of type mac.Options
desktop/main.go:44:4: unknown field ActivationPolicy in struct literal of type mac.Options
```

**Cause:** Newer Wails versions added fields. v2.8.1's `mac.Options` only has:
- `Title`, `Message`, `TitleBar`
- `WebviewIsTransparent`, `WindowIsTranslucent`
- `Preferences`, `DisableZoom`
- `About`

**Fix:** check the actual struct in vendor before referencing fields:
```bash
grep -E "^\t\w+" vendor/github.com/wailsapp/wails/v2/pkg/options/mac/mac.go
```

Use only the fields that exist. For now, the App-level `Debug.OpenInspectorOnStartup` is what we actually need.

### 9.7 Vendor directory regeneration is a big diff

**Symptom:** `go work vendor` rewrites hundreds of files under `vendor/`.

**Cause:** New module (`desktop`) introduces new direct dependencies (Wails, gin if not already vendored). `go work vendor` is the only sanctioned way to refresh.

**Fix:** there's no avoiding it if the project vendors. Warn the user before running. If they regret the diff, `git checkout -- vendor` reverts it (but then the build will fail with `inconsistent vendoring`).

### 9.8 Wails options need the right struct path

Hard to find at a glance — Wails has package-per-option-area:

```go
import (
    "github.com/wailsapp/wails/v2/pkg/options"                  // top-level App, Debug, RGBA
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"      // assetserver.Options
    "github.com/wailsapp/wails/v2/pkg/options/mac"              // mac.Options
    "github.com/wailsapp/wails/v2/pkg/options/windows"          // windows.Options
    "github.com/wailsapp/wails/v2/pkg/options/linux"            // linux.Options
)
```

If you see `undefined: options.Debug.OpenInspectorOnStartup`, you're missing the right struct path.

### 9.9 Cookies / sessions scoped to `wails://` may not stick

**Symptom:** Logged-in user appears logged out across reloads. Or: session cookie set by server is ignored by the WebView.

**Cause:** WebView origin is `wails://wails`. If the server sets cookies with `Domain=your.real.domain` or `Secure; SameSite=None` without HTTPS, the WebView rejects them.

**Fix:** drop the `Domain` attribute and the `Secure` flag for desktop builds, OR run session middleware in a "no-domain" mode when the request comes from the bridge.

Detect bridge requests on the Go side: there's no explicit "this is from the bridge" marker yet. Two options:

1. **Add a marker header in `bridgeFetch.ts`** (`X-Bridge: 1`), check it in middleware:
   ```go
   if c.GetHeader("X-Bridge") == "1" { /* desktop mode */ }
   ```
2. **Inspect `req.Host`** — bridge calls go through with `Host: <whatever-the-URL-had>`, but you can normalize.

### 9.10 Wails dev mode (`wails dev`) doesn't work either with workspaces

Symmetric to §9.1. `wails dev` also tries to parse the desktop module, fails the same way.

**Workaround:** the easy bypass is to NOT use `wails dev`. Build with `-tags desktop debug devtools` (skip `production`), and the binary opens the Inspector automatically. You can rebuild + relaunch manually after edits.

For TRUE hot-reload during dev:
1. Run the frontend's `pnpm dev` separately (it boots a Vite dev server).
2. Build a special "dev-shell" version of the desktop binary that hard-codes the Vite URL:
   ```go
   AssetServer: &assetserver.Options{
       Handler: nil,
       Middleware: nil,
       // override: load from Vite dev server
   },
   ```
   Wails 2.8 supports `frontend:dev:serverUrl: "auto"` in `wails.json` but it requires the CLI; manual workaround: write a `dev/main.go` that calls `webview.Navigate("http://127.0.0.1:5173")` directly. Niche; usually not worth.

### 9.11 The `desktop` module name conflicts with existing tools

Some CI systems / IDEs treat `desktop/` as a special directory. If a clash arises, rename:

- Module name: `wailsshell`
- Path: `<backend-path>/wailsshell/`

Update `go.work` and `replace` directives accordingly.

### 9.12 Wails-injected `runtime.js` is large

Wails injects a ~50 KB runtime script. This is overhead added to your SPA's "first load" within the WebView. It's per-app, not per-page, so the cost is paid once.

### 9.13 `embed.FS` includes hidden files — already handled in §7.9

`//go:embed all:frontend/dist` includes hidden files (`.DS_Store`, `.gitkeep`). The §7.9 copy recipe already runs `find ... -name '.DS_Store' -delete` after the copy, so by following the recipe you'll never see this. Mentioned here only so the gotcha list is complete.

If you find other hidden files accumulating (`.viteignore`, vendor metadata, etc.), extend the find expression in §7.9.

### 9.14 `wails generate module` doesn't work on workspaces (TS bindings)

If you want auto-generated TypeScript bindings for `App.HTTP` (so the frontend can `import { HTTP } from "@/wailsjs/go/main/App"` with full type safety), you'd normally run `wails generate module`. This also fails on workspaces (same root cause as §9.1).

**Workaround in `bridgeFetch.ts`:** the shim defines its own `WailsBridge` type, sidestepping the missing bindings. Type-safe at the shim's boundary; the rest of the frontend code is unchanged.

---

## 10. Streaming responses — the workaround sketch

If the frontend uses streaming (SSE, NDJSON, `httpBatchStreamLink`), the default `App.HTTP` is insufficient.

### Architecture

```
bridgeFetch detects streaming endpoint
   ↓
calls App.HTTPStream(method, path, headers, body) instead of App.HTTP
   ↓
App.HTTPStream returns a request-id immediately
   ↓
Goroutine on Go side runs the handler, capturing flushes:
   - intercept ResponseWriter.Flush()
   - emit each flush as runtime.EventsEmit(ctx, "stream:<id>:chunk", base64Chunk)
   - emit runtime.EventsEmit(ctx, "stream:<id>:end") when done
   ↓
bridgeFetch returns a ReadableStream whose source listens for events:
   - runtime.EventsOn("stream:<id>:chunk", chunk => controller.enqueue(...))
   - runtime.EventsOn("stream:<id>:end", () => controller.close())
   ↓
Frontend consumes the ReadableStream as if it were a real fetch streaming response
```

### Go side sketch

```go
func (a *App) HTTPStream(method, path string, headers map[string][]string, body string) string {
    streamID := uuid.NewString()
    
    go func() {
        rawBody, _ := base64.StdEncoding.DecodeString(body)
        req, _ := http.NewRequestWithContext(a.ctx, method, path, bytes.NewReader(rawBody))
        for k, vs := range headers {
            for _, v := range vs { req.Header.Add(k, v) }
        }
        
        flusher := &streamingResponseWriter{
            streamID: streamID,
            ctx:      a.ctx,
            header:   http.Header{},
        }
        a.engine.ServeHTTP(flusher, req)
        runtime.EventsEmit(a.ctx, "stream:"+streamID+":end")
    }()
    
    return streamID
}

type streamingResponseWriter struct {
    streamID string
    ctx      context.Context
    header   http.Header
    status   int
    wroteHeader bool
}

func (w *streamingResponseWriter) Header() http.Header { return w.header }

func (w *streamingResponseWriter) WriteHeader(status int) {
    if w.wroteHeader { return }
    w.wroteHeader = true
    w.status = status
    runtime.EventsEmit(w.ctx, "stream:"+w.streamID+":head", map[string]any{
        "status": status, "headers": w.header,
    })
}

func (w *streamingResponseWriter) Write(p []byte) (int, error) {
    if !w.wroteHeader { w.WriteHeader(http.StatusOK) }
    runtime.EventsEmit(w.ctx, "stream:"+w.streamID+":chunk", base64.StdEncoding.EncodeToString(p))
    return len(p), nil
}

func (w *streamingResponseWriter) Flush() {} // no-op; we already flush per Write
```

### Frontend side sketch

```ts
async function bridgeStreamFetch(url: string, init: RequestInit): Promise<Response> {
    const w = window as unknown as WailsBridge & {
        runtime: { EventsOn: (name: string, cb: (data: any) => void) => () => void }
    }
    
    const streamID = await w.go!.main!.App!.HTTPStream!(/* … */)
    
    let headInfo: { status: number, headers: Record<string, string[]> } | undefined
    const stream = new ReadableStream({
        start(controller) {
            const offHead = w.runtime.EventsOn(`stream:${streamID}:head`, (h) => { headInfo = h })
            const offChunk = w.runtime.EventsOn(`stream:${streamID}:chunk`, (b64: string) => {
                controller.enqueue(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))
            })
            const offEnd = w.runtime.EventsOn(`stream:${streamID}:end`, () => {
                controller.close(); offHead(); offChunk(); offEnd()
            })
        }
    })
    
    // Wait for head
    while (!headInfo) await new Promise(r => setTimeout(r, 1))
    
    const h = new Headers()
    for (const [k, vs] of Object.entries(headInfo!.headers))
        for (const v of vs) h.append(k, v)
    
    return new Response(stream, { status: headInfo!.status, headers: h })
}
```

### How `bridgeFetch` decides which to call

Look at the `Accept` header or URL path:

```ts
const isStreaming = init.headers && (
    (init.headers as any).accept?.includes("text/event-stream") ||
    url.includes("/stream/") || url.includes("/sse/")
)
return isStreaming ? bridgeStreamFetch(url, init) : bridgeFetch(url, init)
```

This is fully sketched, not implemented in the default skill flow. Only add when streaming is actually used.

---

## 11. Cookies, sessions, auth

### Cookie scoping

WebView origin is `wails://wails`. Server-set cookies must NOT specify `Domain` (or specify it as `wails` / blank). The browser-equivalent rule applies.

Recipes:

```go
// Option A: detect bridge requests via header and skip Domain attribute
func sessionMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        isBridge := c.GetHeader("X-Bridge") == "1"
        // … set cookies without Domain when isBridge ...
    }
}
```

Add to `bridgeFetch.ts`:

```ts
new Headers(init.headers ?? {}).forEach(...)
headers["x-bridge"] = ["1"]   // mark every bridge call
```

### Storage

`localStorage`, `sessionStorage`, `IndexedDB` all work normally in WKWebView. Scoped to `wails://` origin. Persists across app launches.

### Cross-tab login

Wails apps usually have one window, but if you spawn additional windows they share the WebView storage (cookies, localStorage). So a single login on one window propagates.

### Auth flows that depend on OAuth redirects

OAuth redirect URIs like `http://localhost:8080/callback` don't apply inside a WebView. Strategies:

1. **Open the browser for OAuth, deep-link back via custom URL scheme.** Wails supports `mac.Options.URLScheme` (newer versions) to register `myapp://` and receive callbacks.
2. **Embedded WKWebView OAuth window** — open a new Wails window pointing at the OAuth provider's URL. Listen for the redirect URL change, parse token from URL. Less clean but works.
3. **Device code flow** — display a code to the user, they paste it into a browser tab. No redirect needed.

Out of scope for first integration; flag for the user.

---

## 12. Native bridge for OS primitives

Beyond `App.HTTP`, you can expose other bound methods for native features:

```go
import (
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) OpenFileDialog() (string, error) {
    return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
        Title: "Pick a file",
    })
}

func (a *App) ShowNotification(title, body string) error {
    return runtime.Notification(a.ctx, runtime.NotificationOptions{Title: title, Body: body})
}

func (a *App) Quit() { runtime.Quit(a.ctx) }
```

Frontend calls:
```ts
const path = await (window as any).go.main.App.OpenFileDialog()
```

Document each method in your handoff so the frontend team knows what's available.

---

## 13. Hot reload dev workflow

Best workflow given the Wails CLI issue:

### Terminal A: frontend hot reload

```bash
cd <frontend-path>
pnpm dev    # boots Vite at http://127.0.0.1:5173 (or whatever the framework uses)
```

### Terminal B: keep desktop binary running, rebuild on changes

```bash
cd <backend-path>
fswatch -o desktop/*.go saas/pkg/apiboot/*.go | while read; do
    pkill -f <name>-desktop
    sleep 0.3
    CGO_ENABLED=1 CGO_LDFLAGS="-framework UniformTypeIdentifiers" \
        go build -tags "desktop debug devtools" -o /tmp/<name>-desktop ./desktop
    set -a; . .env; set +a
    nohup /tmp/<name>-desktop >/tmp/<name>-desktop.log 2>&1 &
    disown
done
```

(Install `fswatch` via `brew install fswatch`.)

For frontend changes specifically, since they're embedded, you'd also need to `pnpm build` + copy dist + rebuild Go binary. Acceptable cadence: rebuild every 5–10 seconds on save.

Alternative: build a debug variant of `main.go` that loads from `http://127.0.0.1:5173` instead of embedded assets. Frontend hot-reloads instantly; only Go changes need rebuild.

---

## 14. Multi-window pattern

Wails 2.8 supports one window per `wails.Run` by default. Multiple windows require app-level state plus opening additional WebViews via `runtime`:

```go
// Not directly supported in v2.8; use v3 or work around with separate Wails apps
```

For most desktop apps, a single window suffices. If multi-window is needed, consider upgrading to Wails v3 (alpha at time of writing).

---

## 15. Per-OS variations

This skill targets macOS primarily. Notes for the other platforms:

### Windows

- WebView is **WebView2** (Chromium-based). Already installed on Windows 11; redistributable on Windows 10.
- Build with `GOOS=windows go build`. CGO requires `gcc` (use MSYS2 / MinGW-w64).
- `-framework UniformTypeIdentifiers` is macOS-only; omit on Windows.
- Cookie/session behavior closer to a real Chromium browser — less likely to surprise.
- Network tab: **also empty** for bridge calls. Chromium DevTools work the same way.
- Inspector: Chromium DevTools open via right-click → Inspect, or `OpenInspectorOnStartup`.
- Cross-platform builds need Windows-specific build tooling; usually easiest to build on a Windows VM / GitHub Action.

### Linux

- WebView is **WebKitGTK**. Install via apt: `libwebkit2gtk-4.1-dev` (or `-4.0` on older distros).
- Build with `GOOS=linux go build`. CGO needs `gcc`, `libwebkit2gtk-4.0-dev`.
- Cookie/session behavior is WebKit-like (similar to macOS).
- Inspector: GtkInspector instead of Web Inspector; less ergonomic. Right-click → Inspect Element works if dev tags are set.

### Cross-platform builds from one machine

Use Wails's official Docker images if available, or GitHub Actions runners per platform. Cross-compilation of CGO-dependent apps is painful — separate native runners is the standard answer.

---

## 16. Wails version compatibility

| Version | Status | Notes |
|---|---|---|
| 2.8.1 | Current as of this skill | Workspace incompat (§9.1). Smaller mac.Options. |
| 2.9.x | Beta | Some workspace fixes; verify. |
| 2.10+ | Future / current | Better workspace handling expected. |
| 3.x | Alpha | Major API changes. Multi-window. Different binding model. |

**Pin your version** in `go.mod`. Don't `go get -u` Wails without testing.

---

## 17. Bundle, sign, notarize

After the binary works, packaging:

### Build the .app structure

```
Sync.app/
  Contents/
    Info.plist
    MacOS/
      Sync                ← the Go binary, renamed
    Resources/
      icon.icns           ← from `iconutil -c icns iconset/`
    PkgInfo
```

Minimal `Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>Sync</string>
    <key>CFBundleIconFile</key><string>icon.icns</string>
    <key>CFBundleIdentifier</key><string>dev.khanakia.sync</string>
    <key>CFBundleName</key><string>Sync</string>
    <key>CFBundleVersion</key><string>1.0.0</string>
    <key>CFBundleShortVersionString</key><string>1.0.0</string>
    <key>LSMinimumSystemVersion</key><string>11.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
```

### Code-sign

```bash
codesign --deep --force --options runtime \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  Sync.app
```

### Notarize

```bash
xcrun notarytool submit Sync.app.zip \
  --apple-id you@example.com \
  --team-id TEAMID \
  --password "@keychain:notary-pwd" \
  --wait

xcrun stapler staple Sync.app
```

### Wrap in DMG

```bash
hdiutil create -volname "Sync" -srcfolder Sync.app -ov -format UDZO Sync-1.0.0.dmg
```

This is downstream of the integration. Most teams script it once and forget.

---

## 18. Diagnostic recipes

### "Window opens but is blank"

```bash
PID=$(pgrep -f <name>-desktop)
# Check Wails log for asset errors
grep -iE "asset|404|not found|error" /tmp/<name>-desktop.log
```

Common causes:
- `index.html` missing (TanStack `_shell.html` not renamed)
- JS error preventing React from mounting (check Console tab in Inspector)
- Embedded `dist/` is empty (build skipped or `pnpm build` failed)

### "Window opens but no API calls work"

```bash
# Verify bridge is reachable
PID=$(pgrep -f <name>-desktop)
grep -iE "GIN|bridge|HTTP" /tmp/<name>-desktop.log | tail -30
```

If you see `[GIN-debug] GET /api/...` route registrations but no `[GIN]` request logs, bridge calls aren't reaching Gin. Causes:

- `bridgeFetch.ts` not imported by the client config
- `window.go.main.App.HTTP` doesn't exist (Wails bindings didn't load — check Inspector Console for errors)
- Frontend's URL didn't reach `App.HTTP` due to a fallback path in `bridgeFetch.ts`

Add `console.log("isWailsAvailable:", isWailsAvailable())` in `bridgeFetch.ts` to confirm bridge availability.

### "Build fails with EADDRINUSE"

Not possible with this architecture — there's no port binding. If you see this, you've accidentally re-introduced an HTTP server somewhere. Search for `net.Listen` / `http.Serve` in your new code.

### "lsof shows TCP listeners"

```bash
PID=$(pgrep -f <name>-desktop)
lsof -a -nP -p $PID -iTCP -sTCP:LISTEN
```

If this is non-empty, something is binding a port. Common culprits:

- A plugin in `apiboot.Build` that starts its own listener (rare but possible — health-check ports, debug pprof endpoints)
- A `go.uber.org/zap` log shipper opening a TCP port (unusual config)
- `runtime.PProfHandler` if you enabled it

Disable / remove and rebuild.

### "Inspector doesn't open"

Verify build tags include `debug devtools`:
```bash
# In the running binary
strings /tmp/<name>-desktop | grep -i 'devtoolsenabled\|debugmode' | head -5
```

Rebuild with the correct tags if missing.

### "Process won't quit"

Wails on macOS sometimes blocks on shutdown if a background goroutine doesn't return. Force-kill:

```bash
pkill -9 -f <name>-desktop
```

Long-term fix: ensure your `app.go` startup goroutines respect `a.ctx.Done()` for cancellation.

---

## 19. Verification checklist

After §7.15, every one of these MUST be true. If any fails, do NOT claim success.

Wrap each check in `echo` markers so silent-success output is distinguishable from "command quietly errored":

```bash
PID=$(pgrep -f <name>-desktop | head -1)
echo "PID=$PID"
echo "=== alive? ==="          ; ps -p $PID -o pid,stat,comm
echo "=== TCP LISTEN ==="      ; lsof -a -nP -p $PID -iTCP -sTCP:LISTEN ; echo "(end)"
echo "=== UDP ==="             ; lsof -a -nP -p $PID -iUDP ; echo "(end)"
echo "=== ALL TCP ==="         ; lsof -a -nP -p $PID -iTCP ; echo "(end)"
echo "=== GIN routes ==="      ; grep -c '^\[GIN-debug\]' /tmp/<name>-desktop.log
echo "=== GIN requests ==="    ; grep -c '^\[GIN\] ' /tmp/<name>-desktop.log
```

The `(end)` markers prove the lsof command actually ran rather than failed silently between header and prompt.

Checklist:

- [ ] `pgrep -f <name>-desktop` returns a PID.
- [ ] `ps -p $PID` shows the process is alive (state `S` or `R`, not `Z`).
- [ ] `lsof -a -nP -p $PID -iTCP -sTCP:LISTEN` between the markers returns empty (zero inbound TCP).
- [ ] `lsof -a -nP -p $PID -iUDP` between the markers returns empty (zero UDP).
- [ ] `lsof -a -nP -p $PID -iTCP` shows ONLY outbound ESTABLISHED entries (DB, Redis, etc., NOT LISTEN). For minimal backends with no data layer, this section is ALSO empty.
- [ ] `/tmp/<name>-desktop.log` contains `[GIN-debug]` route-registration lines (proves engine booted).
- [ ] The Wails window is visible on the desktop.
- [ ] The Web Inspector window opened automatically (if `debug devtools` tags set).
- [ ] Browser Console shows `[bridgeFetch] →` lines as the user interacts.
- [ ] `/tmp/<name>-desktop.log` shows `[GIN]` request lines as the user interacts.
- [ ] Existing `<api-cmd-main>` still builds: `go build -o /tmp/api-regression ./<api-cmd-path>` succeeds.

---

## 20. Reusable command palette

Substitute the bracketed placeholders.

```bash
# === REBUILD FRONTEND ===
cd <frontend-path>
pnpm build

# === COPY FRONTEND → DESKTOP MODULE ===
rm -rf <backend-path>/desktop/frontend/dist
mkdir -p <backend-path>/desktop/frontend/dist
cp -R <frontend-path>/<frontend-build-output>/* \
      <backend-path>/desktop/frontend/dist/
if [ -f <backend-path>/desktop/frontend/dist/_shell.html ]; then
    mv <backend-path>/desktop/frontend/dist/_shell.html \
       <backend-path>/desktop/frontend/dist/index.html
fi

# === REFRESH VENDOR (only if backend uses vendoring) ===
cd <backend-path> && go work vendor

# === BUILD DESKTOP BINARY ===
cd <backend-path>
CGO_ENABLED=1 CGO_LDFLAGS="-framework UniformTypeIdentifiers" \
  go build -tags "desktop production debug devtools" \
  -o <output-binary-path> ./desktop

# === LAUNCH ===
pkill -f <name>-desktop 2>/dev/null; sleep 1
set -a; . <env-file>; set +a
cd <backend-path>
nohup <output-binary-path> >/tmp/<name>-desktop.log 2>&1 &
disown
PID=$!
echo "PID=$PID"

# === VERIFY ZERO TCP ===
sleep 4
PID=$(pgrep -f <name>-desktop | head -1)
echo "PID=$PID"
echo "INBOUND TCP (should be empty):"
lsof -a -nP -p $PID -iTCP -sTCP:LISTEN
echo "ALL TCP (outbound only):"
lsof -a -nP -p $PID -iTCP
echo "UDP:"
lsof -a -nP -p $PID -iUDP

# === WATCH BRIDGE TRAFFIC ===
tail -f /tmp/<name>-desktop.log | grep '\[GIN\]'

# === STOP ===
pkill -f <name>-desktop

# === REGRESSION CHECK (existing API still builds) ===
cd <backend-path>
go build -o /tmp/api-regression ./<api-cmd-path>
ls -la /tmp/api-regression
rm -f /tmp/api-regression

# === PROCESS INSPECT ===
PID=$(pgrep -f <name>-desktop | head -1)
ps -p $PID -o pid=,rss=,vsz=,pcpu=,etime=,comm=
lsof -p $PID 2>/dev/null | wc -l
lsof -p $PID 2>/dev/null | awk 'NR>1 {print $5}' | sort | uniq -c | sort -rn
```

---

## 21. Rollback

```bash
cd <backend-path>
git checkout -- go.work <api-cmd-main> vendor
rm -rf <api-module-name>/pkg/apiboot
rm -rf desktop

cd <frontend-path>
git checkout -- <files-modified-in-§7.11>
rm -f src/lib/bridgeFetch.ts

rm -f <output-binary-path> /tmp/<name>-desktop.log
rm -f /tmp/api-regression
```

Nothing is committed unless the user explicitly asked. `git status` in both repos should show all modifications cleanly removed.

---

## 22. Decision log

Recorded so a future AI doesn't re-litigate decisions already settled.

| Decision | Alternatives rejected | Reason |
|---|---|---|
| Wails over webview/webview_go | Plain webview lib, hand-rolled CGO | Wails wraps WKWebView + codesign + assetserver. ~3 lines of Go vs ~600 lines of CGO across 3 OSes. |
| HTTP-shaped IPC | gqlgen-only binding, sidecar HTTP, custom RPC | Backend is Gin-coupled. Frontend uses 3+ HTTP-shaped libs. HTTP-IPC keeps both ends unchanged. |
| `httptest.NewRecorder` to dispatch | Loopback HTTP server | User wanted zero TCP. Recorder runs the full middleware chain in memory. |
| Single `App.HTTP` bridge method | Multiple specific binds (Query, Mutate, etc.) | One method handles all clients uniformly. Adding more methods later doesn't break it. |
| `bridgeFetch.ts` at fetch layer | Per-client adapter for each lib | All major HTTP clients accept `fetch:` option. ~90 LOC covers oRPC + tRPC + Apollo + raw fetch. |
| Embed static SPA via `embed.FS` | Custom URL scheme handler | Wails assetserver handles `embed.FS` natively. Custom scheme needs per-OS CGO. Defer to v2. |
| Module inside Go workspace | Standalone `<name>_desktop/` repo | User requested module in workspace. Polyrepo can be extracted later. |
| Direct `go build` over `wails build` | `wails build` | CLI broken on workspaces. Skipping it is harmless given §7.14's flags. |
| Stop at raw binary, defer bundling | Build `.app` + sign + notarize as part of skill | Bundling is downstream; prove architecture works first. |
| Console-log bridge in `bridgeFetch` | Wails internal log only | Console is where developers look first; near-zero perf cost; trivial to suppress later. |
| `Debug.OpenInspectorOnStartup: true` | Right-click → Inspect only | Auto-open removes a step. Requires `debug devtools` tags (documented in §7.14). |
| Base64 encode body across IPC | Raw bytes, hex, JSON-of-bytes-array | Base64 is portable, ~33% overhead, robust. Hex is 100%. JSON-of-array is bloated. |
| Preserve existing `cmd/api` binary | Rewrite into single binary | Production deployment still needs HTTP server. Extraction allows both. |

---

## 23. Definition of done (acceptance for an iteration)

The skill's invocation is "done" only when ALL of these hold:

1. ✅ A binary at `<output-binary-path>` launches and shows a window with the user's frontend.
2. ✅ `lsof -iTCP -sTCP:LISTEN` for the PID is empty.
3. ✅ `[GIN]` request logs appear in `/tmp/<name>-desktop.log` when the user interacts.
4. ✅ `<frontend-path>` has `bridgeFetch.ts` and at least one client config wired to use it.
5. ✅ `<backend-path>/desktop/` exists with `main.go`, `app.go`, `wails.json`.
6. ✅ `<backend-path>/<api-module-name>/pkg/apiboot/` exists with `apiboot.go`.
7. ✅ Existing API server binary still builds.
8. ✅ `AI_CONTEXT.md` written at the project root capturing every change.
9. ✅ The user has been told §9 gotchas relevant to their stack (especially §9.2 if their code uses `config.Get()`-style loaders, §9.5 if streaming, §9.4 about Network tab silence).
10. ✅ NO git commits were made (unless explicitly requested).

If any item is unmet, say so explicitly. Don't claim success.

---

## 24. AI_CONTEXT.md template

When writing the handoff doc, use this template. Substitute real values.

```markdown
# AI Session Handoff — Wails + <backend> + <frontend> Desktop Packaging

> Snapshot YYYY-MM-DD by previous session. No commits made. Feed this entire file to a fresh AI to resume.

## 1. Goal
Package <backend> (<Gin / Echo / ...>) and <frontend> (<TanStack Start / Vite / ...>) into a single native macOS desktop binary using Wails, with ZERO TCP listeners at runtime via HTTP-shaped IPC over the Wails bridge.

## 2. Project layout (post-changes)
<full file tree showing all modified/created paths>

## 3. Architecture
<copy from §3 of the skill>

## 4. Decisions
<copy from §22 of the skill>

## 5. Files changed
| Path | Change |
|---|---|
| <every modified/created file with one-line purpose>

## 6. Build pipeline
<copy from §20 with placeholders substituted>

## 7. Verification commands
<copy from §19 + §20's verify section>

## 8. Known gotchas + workarounds
<copy relevant §9 items based on what was hit during this session>

## 9. Open / pending
<list anything not yet done — e.g. config.Get fix, streaming workaround, .app bundling>

## 10. Current state
<output of pgrep -f / lsof -iTCP -sTCP:LISTEN / build commands as of snapshot>
```

---

## 25. Reference materials within the codebase

When you need to verify Wails behavior, read these vendor paths directly:

- `vendor/github.com/wailsapp/wails/v2/internal/frontend/desktop/darwin/frontend.go` — macOS startup, debug flags, devtools flag wiring.
- `vendor/github.com/wailsapp/wails/v2/internal/frontend/desktop/darwin/window.go` — window creation, `OpenInspectorOnStartup` honored at line ~150.
- `vendor/github.com/wailsapp/wails/v2/internal/frontend/desktop/darwin/WailsContext.m` — Objective-C side; `developerExtrasEnabled = YES` at line ~253.
- `vendor/github.com/wailsapp/wails/v2/internal/app/app_debug.go` + `app_debug_not.go` — `IsDebug()` gated by `debug` build tag.
- `vendor/github.com/wailsapp/wails/v2/internal/app/app_devtools.go` + `app_devtools_not.go` — `IsDevtoolsEnabled()` gated by `devtools` build tag.
- `vendor/github.com/wailsapp/wails/v2/internal/app/app_production.go` — production-mode constructor, sets ctx values for debug/devtools.
- `vendor/github.com/wailsapp/wails/v2/internal/app/app_dev.go` — dev-mode constructor, always sets debug=true.
- `vendor/github.com/wailsapp/wails/v2/pkg/options/mac/mac.go` — `mac.Options` field surface (varies by version; check v2.8.1 specifically).

When upgrading Wails, diff these files to spot behavior changes.

---

## 26. Glossary

| Term | Meaning |
|---|---|
| `embed.FS` | Go 1.16+ feature for embedding files into the binary at compile time. |
| `httptest.NewRecorder` | Stdlib in-memory `http.ResponseWriter`. Captures status, headers, body. |
| `engine.ServeHTTP(rec, req)` | Gin / std `http.Handler` method to dispatch one request. The pivotal trick. |
| WKWebView | macOS system WebView, based on WebKit / Safari engine. |
| WebView2 | Windows system WebView, based on Chromium. |
| WebKitGTK | Linux system WebView, based on WebKit. |
| Wails IPC bridge | Wails's mechanism for calling Go methods from JS. Uses `webkit.messageHandlers` postMessage on macOS. |
| `bridgeFetch` | Our `fetch`-compatible wrapper that routes through the Wails bridge. |
| `apiboot.Build()` | The extracted boot function returning a `*gin.Engine` ready to dispatch. |
| `go work vendor` | Go 1.22+ command to regenerate workspace-level vendor. |
| `_shell.html` | TanStack Start's SPA shell filename (we rename to `index.html`). |
| `mkcert` | Tool to install a local CA for HTTPS dev — NOT used in this architecture. |
| postMessage | Browser API for cross-context messaging. WKWebView's `webkit.messageHandlers.<name>.postMessage(...)` is the native-call hook. |
| XPC | macOS inter-process communication framework. WKWebView uses XPC services internally. |
| `runtime.EventsEmit` | Wails Go-side API to push events to the JS runtime. Used in the streaming workaround (§10). |
| `runtime.EventsOn` | Wails JS-side API to listen for Go-pushed events. |

---

## 27. Final note for future AI

This skill is a tool, not a script. When a step doesn't apply (the user's framework isn't listed, the existing code structure differs from §7.1's assumptions), **adapt**. Don't blindly run commands. The architectural decisions in §22 hold regardless of stack details; the execution recipe in §7 is the suggested path, not the only one.

If you hit a NEW gotcha not in §9, add it to AI_CONTEXT.md so the next session benefits. If a workaround turns out to be wrong or obsolete (e.g. Wails fixes the workspace issue in v2.10), update this skill's content directly.

The user's time matters more than your script. If they look frustrated, stop and ask. If they ask a clarifying question, answer fully before continuing.
