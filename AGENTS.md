# AGENTS.md — Canvie

This is the constitution of the project: how to think before writing a single line of code. Three layers: Identity (why the product exists and what it refuses to be), Process (how work flows from doc to merge), Standards (how code must be). When instinct and this file disagree, this file wins. When this file and docs/ disagree, flag it — don't guess.

---

## Layer 1 — Identity

### 1. Mission

**Product:** Canvie turns the Windows desktop into a persistent visual thinking space. Ideas, images, arrows and references live directly on the desktop — a whiteboard that stays there — instead of inside yet another window.

**User:** anyone who lives on their desktop and thinks visually. They never asked for a whiteboard app; they get a wall.

**Problem solved:** canvas tools are powerful but live inside windows you must open; the desktop — the space you already see every day — is dead surface. Canvie makes it a persistent thinking surface: close the computer, find the same thought where you left it.

**Product philosophy:** the canvas is not a window, it is part of the desktop. Quiet second-plane app: it runs in the background, appears only when needed, disappears when not. Minimalist, warm, slightly playful — never corporate SaaS.

**Business context (shapes everything):** solo founder, MVP-0 proving one thesis: *a canvas on the desktop is useful and pleasant*. Every decision passes "does this prove the thesis with the least machinery?" — never "does this scale?". Shippable simplicity beats clever architecture.

### 2. Product principles — never violate

- **Desktop first.** The desktop is the product, not where the product opens.
- **Persistent by default.** Everything placed on the canvas stays saved; kill, reboot, it comes back identical.
- **Quiet UI.** The interface appears only when needed; canvas and user content are the protagonists.
- **Friendly.** Light and personal. No dashboards, no enterprise chrome.
- **Local-first (MVP-0).** The canvas never leaves the machine: no cloud, no accounts, no sync. Nothing phones home.
- **Light footprint.** The app is always running, so idle must stay quiet: < 150MB RAM, ~0% CPU. A heavy background app betrays the product.

### 3. Decision criteria — conflict resolution, in order

1. Consistency with README.md + docs/MVP-0-ROADMAP.md (source of truth)
2. Windows integration correctness (layering, input, tray, autostart)
3. Simplicity (fewer parts, shippable)
4. UX clarity (the quiet canvas)
5. Performance (only when a measured problem exists)

If a change would require violating #1, stop and flag it — updating the product docs is a founder decision, not a silent side effect.

---

## Layer 2 — Process

### 4. Source of truth — read before implementing

| Doc                        | Holds                                                        |
| -------------------------- | ------------------------------------------------------------ |
| README.md                  | Product vision, modes, shortcuts, v1 scope (pt-BR, user-facing, non-technical) |
| docs/PRD.md                | Frozen MVP-0 requirements + v1 sketch (pt-BR, buildable)     |
| docs/ARCHITECTURE.md       | Runtime, ModeState, layering, bridge, ownership, ADRs        |
| docs/FRONTEND.md           | Canvas, camera, tools, persistence wiring, transparency      |
| docs/BACKEND.md            | Rust state machine, wallpaper.rs, commands/ACL, tray/lifecycle |
| docs/OPERATIONS.md         | Commands, E2E matrix, machine quirks, troubleshooting (pt-BR) |
| docs/MVP-0-ROADMAP.md      | Build order L0–L6, done criteria, hard-won findings per layer |
| AGENTS.md (this file)      | How to think and work here                                   |

Never decide alone what a doc has already decided. Docs > memory > instinct.

### 5. Development flow — always the same

Read docs → Plan → Implement (one small vertical slice, one layer at a time, on a branch) → Test (real hotkeys, real processes, never assume) → Self-review → Update docs (if behavior changed) → PR to main → Assistant code review (§5b) → Address findings → Merge → Tag per milestone (`mvp-0-*`).

Don't start a layer whose predecessors aren't DONE.

### 5b. Assistant code review — the merge gate (replaces CodeRabbit)

Every code PR gets a review by the assistant before merge. Docs-only PRs skip it.

Review angles, in order:

1. Invariants (§10) — any broken Win32/persistence/transparency/shortcut invariant is a blocker.
2. Architecture rules (§9) — layering, ACL permissions, single state machine.
3. Correctness — logic errors, race conditions (hotkey/hot-path threads), error paths that swallow failures.
4. Standards (§11/12) — strict TS/Rust, no dead code, comments only for inexpressible constraints.
5. Tests & evidence — E2E script updated or re-run for behavior changes; frontend + Rust builds green.
6. Docs — README/roadmap updated in the same PR when behavior changed.
7. Security (§14) — writes outside allowed paths, elevated execution, secrets, shell injection via unquoted paths.

Verdict is binary: **approve** or **request changes** with a finding list (file:line + why + suggested fix). Findings are addressed in the PR (fix or reply with justification); re-review until approve, then merge. The review lives in the PR as a comment so the reasoning is on record.

### 6. Checklist — before implementing

- Is there documentation for this? (README.md / docs/)
- Is it inside MVP-0 scope? (the roadmap's frozen scope is a contract)
- Is there an existing pattern, component, or command to reuse?
- Which layer does this belong to, and is the previous one DONE?
- Branch cut from main (`feat/<layer>-<slug>`)?

### 7. Checklist — before considering a task done / merging a PR

- Frontend build passes (`npm run build`: `tsc -b` + vite); `npx oxlint` clean
- Rust compiles (`cargo check`); Tauri bundle builds when the shell changed
- E2E evidence exists (real hotkeys sent, real process/window state asserted — see `scripts/e2e/`)
- Self-reviewed the full diff
- Docs updated in the same commit if behavior/shortcuts/architecture changed
- Commits: imperative, English, `feat:` / `docs:` / `assets:` / `fix:`, explain the why
- Assistant review approved (§5b); every finding fixed or answered
- Squash or small-commit history readable; branch deleted after merge

Branch per change (`feat/<layer>-<slug>`) → PR to main. Docs-only changes may go straight to main.

---

## Layer 3 — Standards

### 8. Engineering philosophy

Simplicity over abstraction. YAGNI. KISS. Don't build infra for users that don't exist.

Explicit over clever; readability over brevity; small functions, small files.

Pure logic at the core (geometry, persistence model), I/O at the edges (Win32, Tauri commands).

Every new dependency must earn its place — each one is compile time, bundle weight and background RAM. Prefer the platform (Canvas 2D, CSS, Win32) over a library.

Optimize only with evidence of a real problem.

### 9. Architecture rules

Never:

- Canvas rendering via a library before raw Canvas 2D proves insufficient.
- A Tauri command without its ACL permission (`AppManifest::commands` in `build.rs` + `allow-*` in `capabilities/default.json`) — the build fails, and that failure is the guardrail working.
- A global shortcut whose registration failure can crash or block startup — log a warn, keep running degraded.
- An autostart entry pointing anywhere but the installed build — never leave a Run key behind that launches a dev binary.
- A second instance — single-instance focuses the running one, always.
- Touch Explorer internals beyond `SetParent` window parenting. No hooks, no shell patching, no DefView style surgery.
- Duplicate a mode/transition rule that already lives in the Rust state machine.

Always:

- One mode state machine in `src-tauri/src/lib.rs` (`ModeState`: mode + return target + embedded + raised); the frontend mirrors it via the `canvie-mode` event, never invents it.
- `wallpaper.rs` owns all Win32 layering; `Canvas.tsx` owns all drawing; `persistence.ts` owns the doc model; `mode.ts` owns the frontend/backend mode bridge.
- Reuse existing commands/helpers before writing new ones.

### 10. Technical invariants — never break

- **Embed AFTER tao.** `tao` rewrites `GWL_STYLE` wholesale on `set_always_on_top` / `set_ignore_cursor_events`, silently dropping our `WS_CHILD`. Any layer transition re-embeds (or re-asserts raise) after every tao call. No exceptions.
- **Progman, not WorkerW.** On this Win11 shell there is no spare fullscreen WorkerW: Progman is the bottom surface and hosts `SHELLDLL_DefView` directly. The canvas is a Progman child resting raised above the icon layer (below taskbar/windows) in Canvas and Locked alike; Locked frees the desktop via click-through.
- **Behind means no input.** A window behind the icon layer never receives clicks (DefView eats all hit-testing) — that is physics, not a bug. Nothing rests behind the icons anymore; the desktop stays usable via the cursor tool (window click-through), not layer order.
- **`Win+T` belongs to Explorer.** `RegisterHotKey` fails with "already registered". MVP-0 uses `Ctrl+Alt+T` until a product decision says otherwise.
- **Persistence never loses data.** `loadDoc()` validates; corrupted JSON returns null and the app boots empty — never crashes. Id counters reseed past restored ids. Saves are debounced (~500ms).
- **Transparency is total.** `html/body/#root` transparent, Tauri window `transparent: true`, no opaque backgrounds anywhere in the shell. A single opaque layer breaks the wallpaper illusion.
- **Fallbacks stay usable.** Every frontend/backend bridge (`invoke`, event listen, storage) degrades to a working canvas when Tauri APIs are absent (browser dev).

### 11. Frontend standards

- Vite + React 19 + TypeScript strict. No `any` without a written justification on the line.
- UI strings in pt-BR, code/comments in English. Copy lives inline for MVP-0 scale (extract when v1 toolbar lands).
- Styling: plain CSS next to components (`App.css`, `index.css`). No CSS framework until v1 earns it.
- Canvas: one `<canvas>` element, DPR-aware, camera transform (`screenToWorld`/`worldToScreen`); strokes/texts as state, drafts in refs (no re-render per pointermove); undo/redo as action stacks in memory.
- The toolbar is always visible above the taskbar and eats clicks only inside its own rect; with click-through on (cursor/Lock) it is visibly unreachable — tray/keys are the way back.
- Click-through is owned by Rust (`set_passthrough` + re-embed + re-raise); the frontend never calls the Tauri window API for it. Bare `V`/`B`/`E` are frontend-only (never global — a bare `B` would steal typing system-wide).
- No dead code, no commented-out code, no forgotten TODOs.

### 12. Rust standards

- `cargo check` clean with no new warnings. Comments only for constraints the code can't express (Win32 quirks qualify; narrating the next line doesn't).
- New commands follow the L4 pattern: `#[tauri::command]` + `AppManifest::commands` entry + `allow-*` capability + frontend wrapper in `mode.ts` with try/catch fallback.
- Log state transitions (`mode ->`, `layer ->`, `hotkey registered`) — in release the log file is the only trace.
- Keep `windows`-crate usage to `Win32_Foundation` + `Win32_UI_WindowsAndMessaging` + `Win32_Graphics_Dwm` (Dwm is only the Overlay blur-behind). No new Win32 surface without a comment explaining why.

### 13. Quality bar

Builds green (frontend + Rust), E2E evidence for behavior changes, docs updated in the same commit. A TODO either becomes roadmap scope or doesn't get written.

### 14. Security

Never: write outside `%APPDATA%/com.canvie.app` and the Run key; run elevated; log paths/contents beyond state transitions; commit machine-specific secrets (there are none — keep it that way).
Always: degrade on denied capability; quote paths; keep installers out of git (they live in the local target dir).

### 15. Living documentation

After any meaningful decision, ask: "does this need to enter the documentation?" If unsure, it does — in the same commit:

| Changed                          | Update                  |
| -------------------------------- | ----------------------- |
| Product behavior / UX / shortcuts | README.md + docs/PRD.md |
| Runtime / modes / layering / bridge | docs/ARCHITECTURE.md |
| Canvas / persistence / transparency | docs/FRONTEND.md     |
| Rust commands / tray / Win32      | docs/BACKEND.md         |
| Commands / E2E / quirks           | docs/OPERATIONS.md      |
| Build order / layer findings      | docs/MVP-0-ROADMAP.md   |
| How to think / work here          | AGENTS.md (this file)   |

### Appendix — practical

| What | Command (run from `frontend/`) |
| ---- | ------------------------------ |
| Frontend build | `npm run build` |
| Rust check | `cargo check` (from `frontend/src-tauri/`) |
| Debug bundle | `npx tauri build --debug` |
| Release bundle | `npx tauri build` |
| E2E (real hotkeys + window asserts) | `powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\<name>.ps1` |
| Open a PR | `gh pr create --fill` (from the feature branch) |
| Merge after approval | `gh pr merge --squash --delete-branch` |
| App log file | `%LOCALAPPDATA%\com.canvie.app\logs\Canvie.log` |
| Installed app | `%LOCALAPPDATA%\Canvie\canvie.exe` |

**Machine quirks (this dev machine — respect all of them):**

- Rust build dir lives OUTSIDE OneDrive: `frontend/src-tauri/.cargo/config.toml` sets `target-dir` to `%LOCALAPPDATA%\canvie-target`. File sync corrupts concurrent builds. Never run cargo with a cwd that bypasses this config.
- 5.9GB RAM / tight disk: always `CARGO_BUILD_JOBS=1`; clean `npm cache` when the disk fills; debug builds are heavy — prefer release incremental.
- `rustc` 1.98 intermittently crashes (`STATUS_STACK_BUFFER_OVERRUN`) on the giant `windows` crate: retry the exact command before changing anything.
- Debug builds are currently unreliable on this machine — validate behavior on release + the log file.
- PowerShell 5.1: no `&&` (use `; if ($?) { }`), `$pid` is reserved, `SendKeys` needs a `WScript.Shell` object, `Set-ExecutionPolicy Bypass -File` for scripts.
- Window handles lie: `MainWindowHandle` points at the `com.canvie.app-sic` helper, not the canvas. Locate `Tauri Window` by PID; after embedding it is a Progman child, invisible to top-level enumeration — search Progman children first.

**Current state (v1 started):** MVP-0 complete through wallpaper embedding + draw-layer toggle + centered pill (tag `mvp-0-instalavel` marks the pre-wallpaper installer) → v1 slice 1: canvas rests raised by default, cursor/brush/eraser toolbar with hover tooltips (`V`/`B`/`E`), click-through cursor frees the desktop, `Ctrl+D` removed. Next: brushes, markdown, backgrounds per README.
