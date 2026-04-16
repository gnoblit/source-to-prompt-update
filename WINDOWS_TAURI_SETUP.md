# Windows Tauri Setup

## Purpose

Document the native Windows validation path for the Tauri desktop shell.

This exists because WSL is our default authoring environment, but **WSL is not native Windows validation**.

For the unified setup guide that also covers WSL and native Linux, see [INSTALL.md](/home/graham/projects/your-source-to-prompt.html/INSTALL.md:1).

## Official Prerequisites

According to the official Tauri v2 prerequisites documentation, Windows development requires:

- Microsoft C++ Build Tools
- Microsoft Edge WebView2
- Rust with an MSVC toolchain

Primary source:

- https://v2.tauri.app/start/prerequisites/

Additional Windows installer notes:

- https://v2.tauri.app/distribute/windows-installer/

## Recommended Windows Setup

### 1. Install Microsoft C++ Build Tools

Install Visual Studio Build Tools and enable:

- `Desktop development with C++`

### 2. Confirm WebView2

WebView2 is preinstalled on many modern Windows versions, but if it is missing install the Evergreen Bootstrapper.

### 3. Install Rust With MSVC

Recommended official command:

```powershell
winget install --id Rustlang.Rustup
```

Then ensure the MSVC host toolchain is active:

```powershell
rustup default stable-msvc
```

### 4. Install Node Dependencies

From the repo root:

```powershell
npm install
```

### 5. Run The Windows Doctor

From the repo root:

```powershell
npm run tauri:doctor:windows
```

### 6. Validate Tauri

From the repo root:

```powershell
npm run tauri:check
npm run tauri:dev
```

## Windows Validation Goal

For the desktop path to be considered genuinely cross-platform, we want native Windows confirmation of:

- app startup
- repository selection
- scan flow
- selection flow
- profile save/load
- combine flow
- clipboard output
- save/download output

## Current State

At the moment:

- Windows support is an explicit target
- the codebase is structured for cross-platform Tauri support
- native Windows validation has not yet been performed

When the first native Windows validation pass happens, the results should also be recorded in [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1).
