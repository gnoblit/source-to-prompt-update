# Your Source to Prompt (Clone + Enhanced)

This repository is a **clone/fork** of the original project:

- Original repo: https://github.com/Dicklesworthstone/your-source-to-prompt.html
- Original author: **Dicklesworthstone**

This clone is maintained separately and includes additional stability, performance, and UX changes focused on large repositories and WSL/Linux browser workflows.

## Important Attribution

- This is **not** the canonical upstream repository.
- Core concept and base implementation come from the original project.
- This fork is **not affiliated with** or endorsed by the upstream author.
- Please star/support the original project if you find this useful.
- Upstream author notes and external/commercial links remain available in the upstream README.

## Why This Clone Exists

The upstream tool is already useful, but our workflow needed more robustness for:

- very large codebases
- repeated reload/refresh cycles
- clearer error visibility
- better behavior in WSL/Linux Chromium environments

## What The Tool Does

`your-source-to-prompt.html` is a single local HTML app that lets you:

- pick a local folder
- select files in a tree UI
- optionally filter by file type/name
- combine selected files into one prompt-friendly output
- optionally remove comments/minify output
- copy or download final combined text

Everything runs locally in-browser.

## Our Changes (Compared to Original)

### 1) Large-Repo Performance

- Virtualized file tree rendering (renders visible rows instead of entire tree DOM).
- Folder rows default to collapsed after scan/refresh.
- Debounced filtering for faster typing responsiveness.
- Reduced expensive re-scans and repeated DOM queries.
- Chunked/yielded scanning to keep UI responsive during long folder reads.

### 2) Selection Behavior and Tree UX

- Added folder expand/collapse toggles.
- Added `Clear All Selections` button.
- Improved `Toggle Select All Text Files` behavior with collapsed/filter states.
- Added folder-level selected/visible counters (e.g. `folder (3/12)`).
- Fixed text detection for common dotfiles/config files (e.g. `.dockerignore`, `.eslintrc`, `.prettierrc`, `.env*`).

### 3) Transformation Pipeline

- Added worker-backed transform pipeline for comment-removal/minification.
- Added fallback to main thread if worker fails.
- Added worker timeout guard.
- Shared application flow now routes background-preferred transform work through host task adapters instead of always executing inline.

### 4) Loading, Progress, and Feedback

- Added loading heartbeat with elapsed time/stage updates.
- Added explicit status messaging during scan/combine/transform phases.

### 5) Error Handling and Diagnostics

- Improved error normalization (`describeError`) with clearer user-facing messages.
- Added in-app **Diagnostics** panel with copy/clear controls.
- Diagnostics now logs picker attempts, restore state, scan lifecycle, and runtime errors.
- Added global runtime error/unhandled rejection capture to diagnostics.

### 6) Folder Access and Restore

- Added picker retry logic for protected/system-folder failures.
- Added **Restore Last Folder** button (manual restore flow).
- Persists folder handle to IndexedDB and restores with permission flow when available.
- Shared shells now attempt a silent startup restore first, then fall back to the manual button when a host requires re-granting access.

## Refresh vs Restore

These are different actions:

- **Refresh Folder**: rescans the currently active folder handle in the same session.
- **Restore Last Folder**: recovers previously saved folder access after page reload (permission-dependent).

## Browser and Environment Notes

Best results:

- Chromium-based browser with File System Access API support.
- If your repo is in WSL Linux paths (`/home/...`), running Chromium inside WSL usually behaves more predictably than Windows Chrome.

Known constraints:

- Browsers may block protected/system-managed folders.
- Folder-handle permission may reset to `prompt` depending on profile/session/security state.
- Native Windows Tauri validation still needs to happen on Windows itself before the desktop path is considered fully cross-platform.

## Current Dev Approach

We are currently developing from **WSL** and treating that as the default authoring environment.

That means:

- browser-shell and JS/package work are expected to run in WSL
- Linux Tauri validation is tracked explicitly through `npm run tauri:doctor` and `npm run tauri:check`
- Windows desktop validation is **not** assumed from WSL and must be tested on native Windows

The detailed environment policy lives in [DEVELOPMENT_APPROACH.md](/home/graham/projects/your-source-to-prompt.html/DEVELOPMENT_APPROACH.md:1).
Current implementation/progress status lives in [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1).

If Linux Tauri desktop checks fail in WSL because GTK/WebKit libraries are missing, install them with:

```bash
npm run tauri:deps:linux
```

If a Tauri command appears stuck because of a stale Cargo target lock, use the fresh-target variants:

```bash
npm run tauri:check:fresh
npm run tauri:dev:fresh
```

While `tauri dev` is running, the launcher now keeps `apps/tauri/.frontend-dist` refreshed in the background so UI and shared-package edits do not require a full restart just to reach the staged frontend. It also refuses to start a second overlapping Tauri CLI run for the same repo, which prevents the shared staged frontend from being stomped by concurrent desktop commands.

Inside WSL, the Tauri launcher now defaults to software rendering and disables WebKit compositing to reduce common `libEGL` / Mesa warnings from the WSL graphics stack.

## Quick Start

1. Open `your-source-to-prompt.html` in a recent Chromium-based browser.
2. Click `Select Folder` and choose your project.
3. Select/filter files.
4. Click `Combine Selected Files`.
5. Copy/download result.
6. After a page reload, the app will try to restore the last folder automatically when host permissions still allow it.
7. If the host needs permission again, use `Restore Last Folder`.

## Troubleshooting

If something fails, open **Diagnostics** in the app and copy the latest logs.
Useful events include:

- `picker-attempt-*`
- `handle-restore-*`
- `window-error`
- `unhandled-rejection`
- `scan-start` / `scan-complete`
- `combine-result`

## Screenshots

|                               |                               |
|-------------------------------|-------------------------------|
| ![Screenshot 1](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_1.png) | ![Screenshot 2](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_2.png) |
| ![Screenshot 3](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_3.png) | ![Screenshot 4](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_4.png) |

## License

License remains subject to the upstream project license (`MIT`, per upstream README).

If you need strict legal confirmation, verify against the upstream repository’s current license files and terms.
