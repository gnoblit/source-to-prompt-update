# Install Guide

## Purpose

This guide pulls the setup story into one place for the three environments we actively care about:

1. WSL
2. Native Linux
3. Native Windows

Use this document when you want to get the repo running from zero, not just understand the validation policy.

## Choose Your Path

- Use **WSL** if you are doing day-to-day development from Linux paths like `/home/...`.
- Use **Native Linux** if you want the Linux desktop app on a real Linux host.
- Use **Native Windows** if you want to validate or run the Windows desktop app.

## Common Repo Setup

These steps are shared across all three environments.

### 1. Install Core Tools

Install:

- Git
- Node.js 20+ with `npm`
- Rust via `rustup` if you want to run the Tauri desktop shell

If you are only using the browser shell, Rust is optional.

### 2. Clone The Repo

```bash
git clone <repo-url>
cd your-source-to-prompt.html
```

### 3. Install JavaScript Dependencies

```bash
npm install
```

### 4. Run The Shared Test Suite

```bash
npm test
```

That validates the shared browser/application/core logic before you move on to desktop-specific setup.

## WSL Setup

This is the preferred authoring environment for the current project.

### Recommended Workspace Location

Keep the repo on a Linux filesystem path such as:

```bash
/home/<you>/projects/your-source-to-prompt.html
```

Avoid placing the working repo under `/mnt/c/...` if you want the smoothest file watching and desktop-dev behavior.

### Browser Workflow In WSL

After `npm install` and `npm test`, you can use the browser shell directly:

- open [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1) in a Chromium-based browser
- or use the extracted browser shell under `apps/browser`

If your repo also lives on WSL Linux paths, Chromium running against those Linux paths tends to behave more predictably than Windows Chrome pointing across the WSL boundary.

### Tauri Desktop Workflow In WSL

If you want the Linux desktop shell from WSL:

1. Install Linux desktop prerequisites:

```bash
npm run tauri:deps:linux
```

That script uses `apt`, so it may prompt for your sudo password.

2. Verify prerequisites:

```bash
npm run tauri:doctor
```

3. Run a fresh compile check:

```bash
npm run tauri:check:fresh
```

4. Launch the desktop shell:

```bash
npm run tauri:dev:fresh
```

Notes:

- the `:fresh` commands avoid stale Cargo target lock confusion
- the Tauri launcher keeps `apps/tauri/.frontend-dist` synchronized while `tauri dev` is running
- overlapping Tauri CLI runs are blocked on purpose so they do not stomp the staged frontend
- when launched from WSL, the repo scripts default to software-rendered WebKit settings to reduce common WSLg graphics issues

## Native Linux Setup

Use this path when you want Linux desktop validation on a real Linux host.

### 1. Install Core Tools

Install:

- Git
- Node.js 20+ with `npm`
- Rust via `rustup`

### 2. Install Tauri Linux Prerequisites

You can use the repo helper:

```bash
npm run tauri:deps:linux
```

Or install them manually on Ubuntu 24.04 / Debian Bookworm:

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

### 3. Install Repo Dependencies

```bash
npm install
```

### 4. Verify The Environment

```bash
npm test
npm run tauri:doctor
npm run tauri:check:fresh
```

### 5. Launch The Linux Desktop App

```bash
npm run tauri:dev:fresh
```

## Native Windows Setup

Use this path for the real Windows desktop app. WSL is not a substitute for this validation.

### 1. Install Core Tools

Install:

- Git
- Node.js 20+ with `npm`
- Rust via `rustup`

### 2. Install Windows Tauri Prerequisites

You need:

- Visual Studio Build Tools with `Desktop development with C++`
- Microsoft Edge WebView2
- Rust using an MSVC toolchain

### 3. Configure Rust For MSVC

```powershell
rustup default stable-msvc
```

### 4. Install Repo Dependencies

From the repo root:

```powershell
npm install
```

### 5. Verify The Windows Desktop Environment

```powershell
npm test
npm run tauri:doctor:windows
npm run tauri:check:fresh
```

### 6. Launch The Windows Desktop App

```powershell
npm run tauri:dev:fresh
```

For more Windows-specific detail, see [WINDOWS_TAURI_SETUP.md](/home/graham/projects/your-source-to-prompt.html/WINDOWS_TAURI_SETUP.md:1).

## First Validation Pass

Once the app opens, the first useful smoke test is:

1. Select a repository
2. Scan it
3. Select files
4. Combine the selection
5. Copy or save the output
6. Restart and verify restore behavior

## Related Docs

- [README.md](/home/graham/projects/your-source-to-prompt.html/README.md:1)
- [DEVELOPMENT_APPROACH.md](/home/graham/projects/your-source-to-prompt.html/DEVELOPMENT_APPROACH.md:1)
- [apps/tauri/src-tauri/README.md](/home/graham/projects/your-source-to-prompt.html/apps/tauri/src-tauri/README.md:1)
- [WINDOWS_TAURI_SETUP.md](/home/graham/projects/your-source-to-prompt.html/WINDOWS_TAURI_SETUP.md:1)
- [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1)
