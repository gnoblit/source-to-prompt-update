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

## Quick Start

1. Open `your-source-to-prompt.html` in a recent Chromium-based browser.
2. Click `Select Folder` and choose your project.
3. Select/filter files.
4. Click `Combine Selected Files`.
5. Copy/download result.
6. After a page reload, use `Restore Last Folder` if needed.

## Troubleshooting

If something fails, open **Diagnostics** in the app and copy the latest logs.
Useful events include:

- `picker-attempt-*`
- `handle-restore-*`
- `scan-start` / `scan-complete`
- `window-error` / `unhandled-rejection`

## Screenshots

|                               |                               |
|-------------------------------|-------------------------------|
| ![Screenshot 1](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_1.png) | ![Screenshot 2](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_2.png) |
| ![Screenshot 3](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_3.png) | ![Screenshot 4](https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/screenshots/screenshot_4.png) |

## License

License remains subject to the upstream project license (`MIT`, per upstream README).

If you need strict legal confirmation, verify against the upstream repository’s current license files and terms.
