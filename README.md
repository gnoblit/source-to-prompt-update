# Your Source to Prompt

This repository is a maintained fork of the original project by **Dicklesworthstone**:

- Original repo: https://github.com/Dicklesworthstone/your-source-to-prompt.html
- Original concept and base implementation come from that upstream project

This fork is now centered on a **desktop-first Tauri endpoint** with a shared application/core architecture and a browser shell kept as a secondary path.

Install/setup directions live in [INSTALL.md](/home/graham/projects/your-source-to-prompt.html/INSTALL.md:1).
Current implementation status lives in [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1).

## Product Direction

The repo now has two runtime shells:

- **Primary endpoint:** Tauri desktop app in `apps/tauri`
- **Secondary/fallback endpoint:** browser shell in `apps/browser`

Both shells share the same extracted:

- core logic
- application/controller layer
- shell UI modules
- host contract model

That means the project is no longer just “one HTML file with some patches.” The monolithic HTML app still exists for continuity, but the architectural direction is the layered desktop product.

## What It Does

Your Source to Prompt lets you:

- select a local repository
- scan and filter the file tree
- select a focused set of text files
- optionally add framing like a preamble or goal
- optionally apply output transforms
- generate one prompt-ready combined output
- copy, download, or save the result

The desktop shell is the preferred path because it gives us native file access, restore flows, clipboard/save integration, and a more dependable local workflow.

## Current State

What is already real in this fork:

- shared core/application architecture
- browser host implementations
- Tauri bridge + host implementations
- shared shell UI used by both browser and Tauri
- saved-repository restore flow
- diagnostics capture with copy/clear controls
- background-preferred transform execution through host task adapters
- Linux-side Tauri compile validation through `npm run tauri:check:fresh`

What is not fully validated yet:

- native Windows desktop runtime validation
- completed Linux desktop smoke-test record for the current shell UX

For the detailed validation matrix, use [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1).

## Quick Start

### Preferred: Tauri Desktop

From the repo root:

```bash
npm install
npm test
npm run tauri:doctor
npm run tauri:check:fresh
npm run tauri:dev:fresh
```

If Linux desktop prerequisites are missing, install them with:

```bash
npm run tauri:deps:linux
```

### Secondary: Browser Shell

If you want the browser path instead:

```bash
npm install
npm test
```

Then open the browser shell or legacy monolith locally:

- [apps/browser/index.html](/home/graham/projects/your-source-to-prompt.html/apps/browser/index.html:1)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1)

## Recommended Desktop Smoke Test

Once the Tauri app opens:

1. Select a repository.
2. Confirm the tree loads and nesting is visible.
3. Select files or use the bulk text-file selector.
4. Generate a prompt bundle.
5. Copy or save the output.
6. Restart and verify restore behavior.

## Environment Notes

- We are currently developing primarily from **WSL on Linux paths**.
- WSL is a valid authoring environment for JS/package work and Linux-oriented Tauri checks.
- **WSL is not native Windows validation.**
- Native Windows desktop behavior still has to be tested on Windows itself.

The environment policy is documented in [DEVELOPMENT_APPROACH.md](/home/graham/projects/your-source-to-prompt.html/DEVELOPMENT_APPROACH.md:1).

## Tauri Workflow Notes

- Prefer `npm run tauri:check:fresh` and `npm run tauri:dev:fresh` to avoid stale Cargo target lock confusion.
- While `tauri dev` is running, the launcher keeps `apps/tauri/.frontend-dist` synchronized with current shell/package code.
- Overlapping Tauri CLI runs are blocked so concurrent desktop commands do not stomp the shared staged frontend.
- In WSL, the launcher defaults to software-rendered WebKit settings to reduce common WSLg graphics issues.

## Browser Workflow Notes

The browser shell still matters, but it is no longer the primary product target.

Use it when:

- you want quick JS/UI iteration without the desktop runtime
- you are validating shared shell behavior
- desktop prerequisites are temporarily unavailable

Remember:

- browser file access depends on File System Access API support
- some protected/system folders may be blocked
- permission restore behavior depends on browser security state

## Related Docs

- [INSTALL.md](/home/graham/projects/your-source-to-prompt.html/INSTALL.md:1)
- [DEVELOPMENT_APPROACH.md](/home/graham/projects/your-source-to-prompt.html/DEVELOPMENT_APPROACH.md:1)
- [apps/tauri/src-tauri/README.md](/home/graham/projects/your-source-to-prompt.html/apps/tauri/src-tauri/README.md:1)
- [WINDOWS_TAURI_SETUP.md](/home/graham/projects/your-source-to-prompt.html/WINDOWS_TAURI_SETUP.md:1)
- [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1)

## Attribution

- This is not the canonical upstream repository.
- This fork is not affiliated with or endorsed by the upstream author.
- If you find the project useful, please support the upstream project as well.

## License

License remains subject to the upstream project license (`MIT`, per upstream README).
