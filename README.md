# Your Source to Prompt

Electron-first desktop app for selecting repository files, shaping prompt framing, and exporting one clean prompt bundle.

## Commands

```bash
npm install
npm run dev
npm run stop
npm test
```

## Structure

- `apps/electron`: desktop shell
- `apps/browser`: browser-only fallback shell
- `packages/application`: controller and app state
- `packages/core`: scanning, transforms, selection, output engines
- `packages/shell-ui`: shared UI shell
- `packages/host-impl-browser`: browser host adapters
- `packages/host-impl-electron`: Electron host adapters

## Notes

- `npm run dev` launches Electron.
- `npm run stop` kills the Electron process tree for this repo.
- The browser shell remains available for web-only testing, but Electron is the desktop product.
