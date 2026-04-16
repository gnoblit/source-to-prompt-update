# System Status

## Purpose

Track architectural progress in a way that stays grounded in the actual repo state, validation status, and host-specific blockers.

This document should answer three questions quickly:

1. What is already real in the codebase?
2. What remains blocked or unverified?
3. What environment should be used to verify the next step?

## Update Protocol

When this file is updated after a meaningful implementation chunk, record changes in this order:

1. Update the milestone status that changed.
2. Update the validation matrix entry that changed.
3. Add or remove blockers only if the actual constraint changed.
4. Keep `Next Recommended Steps` focused on the shortest path to host-native validation.

Preferred status vocabulary:

- `complete`
- `in progress`
- `blocked`
- `pending`

## Current Snapshot

Date context:

- Active development environment: WSL on Linux paths
- Current primary target: Tauri desktop shell
- Secondary target: browser shell

Current high-level status:

- core/application layering is real
- browser host path is real and tested
- Tauri host path is real and tested at the contract/integration level
- shared shell UI exists and is used by both browser and Tauri shells
- saved-repository remember/restore workflow now exists across controller + shell + capable hosts
- startup now performs a silent restore attempt before falling back to manual re-grant flow
- transform execution can now use host-provided background workers with inline fallback
- shared shells now capture top-level runtime failures into diagnostics and support diagnostics copy/clear actions
- Tauri Rust backend scaffold exists
- Linux desktop compile validation now passes after Linux prerequisites are installed
- Windows desktop validation has not yet been executed on native Windows

## Milestone Progress

### Milestone 1: Repository Structure And Contracts

Status:

- complete

Notes:

- workspace layout exists
- host contracts exist
- package boundaries are established

### Milestone 2: Core Models And Error Contracts

Status:

- complete

Notes:

- core models, error normalization, ignore rules, scan/selection/output/transform engines exist
- core tests are passing

### Milestone 3: Application Layer

Status:

- complete

Notes:

- state, selectors, use cases, and controller exist
- application tests are passing

### Milestone 4: Browser Host And Browser Shell

Status:

- complete

Notes:

- browser hosts exist
- browser shell boots through the extracted architecture
- profile persistence and output flows are wired
- restore-last-folder UI is wired through the shared shell and controller workflow
- startup silently restores the last saved repository when host permissions still allow it
- browser task host can execute transform work through a worker-backed path
- shared-shell diagnostics capture runtime errors and support copy/clear actions

### Milestone 5: Shared Shell Extraction

Status:

- complete

Notes:

- shared shell modules live in `packages/shell-ui`
- browser and Tauri both use the shared shell surface

### Milestone 6: Tauri Host And Bootstrap

Status:

- complete

Notes:

- JS-side Tauri bridge and host implementations exist
- Tauri entry/bootstrap path exists
- Rust command scaffold exists in `apps/tauri/src-tauri`
- Tauri repository handles can now be serialized for saved-repository restore
- Tauri task host can prefer a local worker-backed transform path before bridge fallback
- shared-shell diagnostics behavior now applies in the Tauri shell too
- Linux-side `cargo check` now passes in the configured WSL/Linux environment
- host-native runtime smoke validation is still incomplete

### Milestone 7: Tauri Desktop Validation

Status:

- in progress

Blockers:

- native Windows validation not yet performed

## Validation Matrix

### WSL / Linux Userland

Status:

- passing for JS/unit/integration workflow

Validated:

- `npm test`
- `npm exec tauri -- --version`
- `npm run tauri:doctor`
- cross-platform Node-based Tauri doctor/cargo wrapper scripts
- saved-repository remember/restore controller workflow
- shared-shell startup auto-restore workflow with manual re-grant fallback
- background-preferred transform execution through browser/Tauri task hosts
- shared-shell runtime diagnostics capture plus diagnostics copy/clear controls
- Rust toolchain installed locally
- `npm run tauri:check:fresh`
- repo now includes a one-command Linux dependency installer: `npm run tauri:deps:linux`
- repo now includes fresh-target Tauri commands to avoid stale Cargo lock confusion
- Tauri CLI launcher now blocks overlapping desktop runs and keeps `.frontend-dist` refreshed during `tauri dev`

Not yet validated:

- successful Linux `tauri dev`

### Native Linux Desktop

Status:

- in progress

Needed:

- `npm run tauri:dev`

### Native Windows Desktop

Status:

- pending

Needed:

- Windows Tauri prerequisites
- `npm run tauri:doctor:windows`
- `npm run tauri:check`
- `npm run tauri:dev`

## Current Known Blockers

### Linux Tauri Dependencies

The Linux dependency gap is now addressed through `npm run tauri:deps:linux`, but each machine still needs those packages installed locally before desktop commands can compile.

### Windows Desktop Validation Gap

The codebase is designed for Windows support, but native Windows compile/run validation has not happened yet.

## What Is Solid Right Now

- core logic extraction
- application orchestration
- browser host contracts and runtime path
- Tauri JS bridge and host contracts
- shared shell UI
- repository remember/restore workflow
- host-backed background transform execution with inline fallback
- shared-shell diagnostics controls and runtime failure capture
- profile workflows
- output workflows
- integration coverage around host composition

## Next Recommended Steps

1. Run `npm run tauri:dev:fresh` on a Linux desktop-capable host.
2. Validate one end-to-end desktop flow: select repo, scan, combine, and copy/save output.
3. Run the Windows setup/check path on native Windows.
4. Record Linux and Windows Tauri smoke-test outcomes here once completed.
