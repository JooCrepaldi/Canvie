# Canvie agent instructions

This file is the working contract for agents in this repository. Read it before changing code or product behavior. Follow direct system, developer, and user instructions first. When this file conflicts with a more specific instruction under the working directory, use the more specific file and record the scope in the change.

## Product identity

Canvie keeps one local canvas in a rectangle of the Windows desktop that the user drags to define. The user calls a focused editing layer with a shortcut, draws or writes Markdown notes and post-its, and fixes the area back to the desktop.

The MVP proves one claim: a canvas on the desktop is useful and pleasant. Choose the smallest change that tests that claim. Keep the app local-first, quiet, friendly, and light while it runs in the background.

Product constraints:

- Windows is the only target in the current cycle.
- Canvas content stays on the machine. There are no accounts, cloud sync, analytics, or collaboration features in the MVP.
- The desktop is the product. A normal app window is a support surface for focused editing.
- Persistent state includes content, canvas position, size, monitor, and user preferences.
- The toolbar has a separate side handle. Dragging the handle moves the toolbar; clicking a tool never moves it.
- Wall and Edit are the only window placements in the first cycle. The product calls Wall **Fixo**. The transition must save before returning to Wall.
- The first cycle offers one choice of each kind: a paper or transparent background, one brush in three colors, and one font in three sizes. More options wait for the cycle to prove the transition.

## Read the right document first

Use the document that owns the question. Do not copy a rule into a second document when a link is enough.

| Question or change | Authoritative document |
| --- | --- |
| What the product is, who uses it, and what belongs in the MVP | [`product.md`](product.md) |
| How to install, run, build, and find documentation | [`README.md`](README.md) |
| How processes, state, ownership, persistence, and Windows integration fit together | [`architecture.md`](architecture.md) |
| What the UI looks like and how it behaves visually | [`design_system.md`](design_system.md) |
| Why a hard-to-reverse choice was made | [`decisions/`](decisions/) |
| Current product contract for the first cycle | [`docs/PRD.md`](docs/PRD.md) |
| Detailed runtime, frontend, backend, operations, or roadmap facts | [`docs/`](docs/) |
| Domain terms without implementation details | [`CONTEXT.md`](CONTEXT.md) |

When product intent conflicts with shipped behavior, name the conflict. Treat `product.md` as the target and `docs/PRD.md` plus the code as the delivered state until the user chooses a change. Never resolve a product conflict by silently changing scope.

## Work in small, verifiable slices

Follow this sequence for code and behavior changes:

1. **Classify the change.** Identify product, architecture, frontend, backend, UI, operations, or documentation scope.
2. **Read the owner documents.** Read the relevant root document and the matching file under `docs/` before planning.
3. **Inspect the repository.** Check the actual tree, package scripts, Rust configuration, capabilities, and existing patterns. Do not invent a path that is absent.
4. **Plan one vertical slice.** State the smallest user-visible behavior, its owner, its failure path, and its completion evidence.
5. **Implement in the owning layer.** Keep domain logic pure and keep Windows, filesystem, and Tauri I/O at the boundary.
6. **Verify the real behavior.** Run the narrowest useful build, check, or E2E flow. Prefer actual hotkeys, windows, tray state, files, and logs over mocks.
7. **Update documentation in the same change.** Update the owner document when product behavior, shortcuts, architecture, operations, or visual rules change.
8. **Review the full diff.** Check scope, ownership, permissions, error paths, user-facing copy, and stale links.

The slice is complete only when the code or document is changed, the requested behavior is observable, and the evidence is recorded in the final report or the relevant operations document.

Do not start a later roadmap layer while its predecessor lacks its done evidence. See [`docs/MVP-0-ROADMAP.md`](docs/MVP-0-ROADMAP.md) and [`docs/ROADMAP-0.0.2.md`](docs/ROADMAP-0.0.2.md).

## Source control and delivery

Use a branch named `feat/<layer>-<slug>`, `fix/<slug>`, or `docs/<slug>` when a Git repository and remote are available. Docs-only changes may go directly to `main` when the project workflow allows it.

Use imperative English commit messages with these prefixes:

- `feat:` for a user-facing capability.
- `fix:` for a behavior correction.
- `docs:` for documentation.
- `assets:` for visual assets.

A code change is ready for a pull request when the frontend and Rust checks pass, the relevant E2E evidence exists, the diff is self-reviewed, and the owning documents are current. Docs-only changes skip code review, but still need link, command, heading, and consistency checks.

Every code pull request requires an assistant review before merge. Review in this order:

1. Windows, persistence, transparency, shortcut, and security invariants.
2. Layer ownership, Tauri permissions, and the single state machine.
3. Correctness, race conditions, and error paths.
4. TypeScript and Rust standards, dead code, and unnecessary dependencies.
5. Build, E2E, and log evidence.
6. Documentation for changed behavior.

The review returns **approve** or **request changes** with file, line, reason, and suggested fix. Address every finding or record a concrete justification before merge.

## Architecture contracts

The target stack is Tauri 2, Vite, React 19, strict TypeScript, Rust, and Canvas 2D. Keep the public ownership split below:

- `frontend/src/canvas/` owns drawing, camera transforms, notes, post-its, the area rectangle, and element interaction.
- `persistence.ts` owns document validation, loading, saving, debounce, and saveNow.
- `placement.ts` owns the frontend wrapper around backend placement commands and events.
- `frontend/src-tauri/src/lib.rs` owns the single `PlacementState`, commands, events, tray, lifecycle, and global shortcuts.
- `wallpaper.rs` owns all Win32 parent, style, transparency, hit-testing, and Z-order work.
- `src-tauri/capabilities/` owns the smallest permissions that expose commands or plugins to a window.

The frontend mirrors backend mode events. It does not create a second mode machine. The backend does not draw canvas elements.

For Tauri commands, complete all of these steps:

1. Add the typed `#[tauri::command]` function.
2. Register it with the handler and the app manifest when required.
3. Add the narrow capability or permission.
4. Add a typed frontend wrapper with error handling and a browser fallback where development needs it.

Tauri capabilities are a security boundary, not a convenience list. Grant only the command and scope the window needs. The official reference is linked from [`architecture.md`](architecture.md).

## Windows invariants

These invariants are blockers during review:

1. **Re-embed after `tao`.** Calls that change `always_on_top`, `ignore_cursor_events`, or visibility rewrite window styles. Reapply the parent, `WS_CHILD`, and Z-order after every such call. A window with `WS_EX_LAYERED` also needs `SetLayeredWindowAttributes`, or Windows does not draw it.
2. **Use the tested desktop parent.** Wall uses the `Progman` relationship defined in the architecture docs. Do not introduce Explorer hooks, `WorkerW` surgery, or DefView patching.
3. **Treat Wall as non-interactive.** A window behind the icon layer cannot receive desktop input. Use backend click-through for the Wall path.
4. **Keep `Win + T` reserved.** Use `Ctrl + Alt + T` for Edit until a recorded product decision changes it.
5. **Preserve data.** Validate loaded JSON, boot empty on corruption without crashing, reseed ids beyond restored ids, and debounce saves without deleting the last valid document.
6. **Keep transparency outside the area.** `html`, `body`, `#root`, and the Tauri shell stay transparent. Only the area paints its chosen background, and Edit adds the dim around it.
7. **Keep fallbacks usable.** Missing Tauri APIs in browser development must leave a working canvas. A denied capability must degrade with a warning, not prevent startup.
8. **Keep startup installed.** Autostart must target the installed executable and never a development binary.
9. **Keep one instance.** A second launch focuses the running instance and exits.

## Frontend standards

- Use strict TypeScript. Do not use `any` without a written reason on the same line.
- Keep UI strings in pt-BR. Keep code, symbols, and comments in English.
- Use plain CSS next to components. Add a styling dependency only after a measured need and a recorded decision.
- Use one DPR-aware canvas with `screenToWorld` and `worldToScreen` transforms.
- Keep pointer drafts in refs. Do not re-render React state for every pointer move.
- Keep undo and redo as explicit action stacks.
- Keep the toolbar compact, with visible focus, accessible names, a separate handle, and a recoverable route through tray or shortcuts when click-through is active.
- Do not leave dead code, commented-out code, or untracked TODOs. Move real future work into `product.md` or the roadmap.

## Rust standards

- Keep `cargo check` free of new warnings.
- Use comments for constraints the type system cannot express, such as Win32 behavior. Do not narrate the next line.
- Log mode transitions, layer changes, shortcut registration, startup, persistence failures, and degraded fallbacks.
- Keep Windows crate use within the surfaces documented by [`docs/BACKEND.md`](docs/BACKEND.md). Add a decision before expanding the surface.
- Return typed errors or clear status values. Do not swallow an error that changes user-visible behavior.

## Security and data boundaries

- Store user data under `%APPDATA%/com.canvie.app`.
- Never run elevated.
- Never log canvas contents, personal paths, secrets, or clipboard data.
- Quote paths passed to shell commands.
- Keep installers in the local target output, not in Git.
- Keep `.agents/skills/` and other local agent state ignored. Skills are working instructions, not project content.

## Verification commands

Run commands from the directory that owns the script. PowerShell 5.1 does not support `&&`; use separate lines or `if ($?) { }`. `$pid` is a reserved variable.

```powershell
Set-Location frontend
npm run build
npx oxlint
Set-Location src-tauri
$env:CARGO_BUILD_JOBS = "1"
cargo check
```

For a release bundle:

```powershell
Set-Location frontend
npm run tauri build
```

For E2E scripts:

```powershell
Set-Location frontend
powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\<name>.ps1
```

Run E2E only when the change affects runtime behavior. Use real hotkeys, real processes, real window state, and release logs. The machine has limited RAM, so keep `CARGO_BUILD_JOBS=1` and use the target directory configured outside OneDrive.

## Documentation rules

Update the smallest authoritative document that owns the change, then update cross-links when the public map changes:

| Change | Update |
| --- | --- |
| Product behavior, user flow, shortcuts, MVP boundary | `product.md` and `docs/PRD.md` when delivered behavior changes |
| Runtime, state, layering, bridge, ownership | `architecture.md` and the matching file under `docs/` |
| Tokens, components, accessibility, UI states | `design_system.md` |
| Hard-to-reverse tradeoff | A numbered file under `decisions/` |
| Build, E2E, logs, machine quirks | `docs/OPERATIONS.md` |
| Build order or layer evidence | `docs/MVP-0-ROADMAP.md` and `docs/ROADMAP-0.0.2.md` |
| Domain terminology | `CONTEXT.md` |

Use links instead of duplicating a rule. Keep root docs concise and move deep implementation details into `docs/`. A decision record must state context, the decision, consequences, alternatives, status, and date.

## Review checklist

Before declaring work complete, confirm:

- The change matches `product.md` or records the product decision that changes it.
- The correct layer owns each new rule.
- Capabilities and scopes are minimal.
- Error paths degrade safely and leave a useful log.
- Persistence keeps the last valid state.
- Windows layering and input invariants still hold.
- Accessibility names, focus, keyboard paths, contrast, and DPI behavior are covered.
- Documentation links and commands point to existing files or are explicitly marked as future layout.
- The final report states what changed and what evidence was run.
