# Tauri Shell

This directory now contains the first real desktop runtime scaffold for the primary endpoint.

For full environment bootstrap instructions across WSL, native Linux, and native Windows, see [INSTALL.md](/home/graham/projects/your-source-to-prompt.html/INSTALL.md:1).

Current scope:

- Tauri v2 project structure
- bridge-backed command registration in `src/lib.rs`
- native repository selection and file access commands
- local JSON-backed persistence commands
- native clipboard and file save/download commands
- shared shell UI served from `apps/tauri/index.html`

What is still missing:

- production packaging and icons
- native Rust-side task offload if we later decide some workloads should leave the webview worker path
- shell-specific desktop polish

## Local Linux Prerequisites

The current Ubuntu 24.04 / Debian Bookworm path follows the official Tauri v2 Linux prerequisites:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Helpful local commands in this workspace:

```bash
npm run tauri:doctor
npm run tauri:deps:linux
npm run tauri:doctor:windows
npm run tauri:check:fresh
npm run tauri:dev:fresh
```

Recommended desktop-loop behavior:

- prefer `npm run tauri:check:fresh` and `npm run tauri:dev:fresh` so Cargo target locks do not make the desktop workflow look hung
- the repo launcher keeps `apps/tauri/.frontend-dist` synchronized while `tauri dev` is running, so shared UI/package edits reach the staged desktop frontend without requiring a full restart
- the launcher blocks overlapping Tauri CLI runs for this repo so concurrent desktop commands do not stomp the shared staged frontend

## WSL Note

We are currently developing in WSL.

That is a valid authoring environment for:

- JS/package work
- shared shell work
- Rust/Tauri code authoring
- Linux prerequisite checks

But it is not the same as native Windows validation.

Treat verification as separate tracks:

- WSL/Linux for Linux desktop readiness
- native Windows for Windows desktop readiness

When launched from WSL through the repo scripts, the Tauri CLI now defaults to software rendering plus disabled WebKit compositing to reduce common EGL/Mesa warnings from WSLg.

Windows setup details:

- [WINDOWS_TAURI_SETUP.md](/home/graham/projects/your-source-to-prompt.html/WINDOWS_TAURI_SETUP.md:1)
