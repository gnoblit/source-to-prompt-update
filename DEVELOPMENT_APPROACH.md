# Development Approach

## Purpose

Define how we develop and validate this project while the architecture is transitioning from the monolithic HTML app to the layered browser and Tauri shells.

This document exists so that environment assumptions are explicit, especially because we are currently developing inside **WSL**.

## Current Working Assumption

Primary day-to-day development happens in **WSL on Linux paths**.

That means our default workflow should optimize for:

- fast iteration in WSL
- JS/package work inside Linux userland
- browser-shell verification from the shared workspace
- Linux-oriented Tauri dependency checks

It should **not** assume that WSL validation is the same thing as native Windows validation.

## Environment Roles

### WSL: Primary Development Environment

Use WSL for:

- package and workspace changes
- core/application/host refactors
- Node-based tests
- browser-shell development
- Tauri Rust code authoring
- Linux desktop dependency checks for Tauri

Why:

- the repo already has strong Linux/WSL workflow history
- filesystem behavior is predictable for `/home/...` repositories
- this keeps the default dev loop fast and local

### Native Linux: Linux Desktop Validation Target

Use native Linux, or WSL with the necessary GUI stack installed, for:

- `cargo check` on the Tauri app
- `tauri dev` smoke tests
- validating Linux packaging assumptions
- validating GTK/WebKit runtime behavior

Why:

- the Linux Tauri shell depends on native GTK/WebKit system libraries
- browser-only validation is not enough for the desktop endpoint

### Native Windows: Windows Desktop Validation Target

Use native Windows for:

- `cargo check` / `tauri dev` on Windows
- validating file dialogs, clipboard, and save flows on Windows
- validating path handling and packaging on Windows

Why:

- WSL is not a Windows desktop runtime
- a Tauri app that works in WSL or Linux is not automatically validated for Windows
- Windows-specific filesystem and shell behavior must be exercised on Windows itself

## Policy

### Rule 1: WSL Is The Default Authoring Environment

We should assume most coding, refactoring, and JS verification happens in WSL unless there is a concrete reason to leave it.

### Rule 2: Tauri Requires Host-Native Validation

For desktop work, we do not treat:

- browser-shell success
- WSL-only success
- bridge/unit-test success

as equivalent to full Tauri validation.

Desktop features are only considered properly validated when the relevant host has been exercised directly.

### Rule 3: Linux And Windows Are Separate Validation Tracks

The Tauri shell should be treated as a **cross-platform product**, but verification should be tracked separately for:

- Linux
- Windows

Passing one does not imply the other.

### Rule 4: Browser Remains The Fallback Verification Path

If native desktop prerequisites are missing, we continue to:

- advance the architecture
- keep browser-shell behavior healthy
- keep host contracts and integration tests green

But we explicitly record desktop validation as pending rather than hand-waving it away.

## Practical Workflow

### Day-To-Day Loop In WSL

Use this as the normal inner loop:

```bash
npm test
npm run tauri:doctor
```

If the Linux Tauri prerequisites are installed:

```bash
npm run tauri:check
```

### Linux Tauri Validation Loop

When GTK/WebKit packages are available:

```bash
npm run tauri:doctor
npm run tauri:check
npm run tauri:dev
```

### Windows Tauri Validation Loop

Run from native Windows, not from WSL:

```bash
npm test
npm run tauri:check
npm run tauri:dev
```

The exact Windows prerequisite install can be documented separately, but the policy is simple:

- code in WSL if convenient
- validate Windows desktop behavior on Windows

Doctor command behavior:

- `npm run tauri:doctor` auto-selects Linux vs Windows based on the current host platform
- `npm run tauri:doctor:linux` and `npm run tauri:doctor:windows` remain available for explicit targeting

## Definition Of Done For Desktop Changes

For changes that affect the Tauri shell, the preferred validation ladder is:

1. `npm test`
2. `npm run tauri:doctor`
3. `npm run tauri:check` on Linux when Linux prerequisites exist
4. `npm run tauri:dev` smoke test on Linux
5. `npm run tauri:check` on native Windows
6. `npm run tauri:dev` smoke test on native Windows

If steps 3 through 6 are blocked by host prerequisites, that should be stated explicitly in status updates and docs.

## Current Status

At the moment:

- WSL is the active development environment
- JS/unit/integration coverage is running successfully in WSL
- Rust toolchain and Tauri CLI are installed locally in the workspace
- Linux Tauri compile verification is blocked by missing GTK/WebKit system libraries
- Windows desktop validation has not yet been performed

That is acceptable as a **current state**, but it should not be mistaken for full desktop readiness.

Progress tracking reference:

- [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1)

Windows setup reference:

- [WINDOWS_TAURI_SETUP.md](/home/graham/projects/your-source-to-prompt.html/WINDOWS_TAURI_SETUP.md:1)
