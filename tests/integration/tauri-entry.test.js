import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasResolvableTauriBridgeSource,
  resolveTauriBridgeSource
} from '../../apps/tauri/src/bridge.js';
import {
  bootTauriEntry,
  bootTauriUiWhenReady,
  waitForResolvableTauriBridgeSource
} from '../../apps/tauri/src/entry.js';

function createDirectory(name, entries = []) {
  return {
    name,
    kind: 'directory',
    entries
  };
}

function createFile(name, content, options = {}) {
  return {
    name,
    kind: 'file',
    content,
    size: options.size ?? content.length
  };
}

function createWindowWithBridge() {
  const rootHandle = createDirectory('project', [
    createDirectory('src', [createFile('index.ts', 'export const value = 1;\n')])
  ]);
  const storage = new Map();

  function findPathHandle(baseHandle, targetPath) {
    const parts = String(targetPath)
      .split('/')
      .filter(Boolean);
    let current = baseHandle;

    for (const part of parts) {
      if (!current || current.kind !== 'directory') {
        return null;
      }
      current = current.entries.find((entry) => entry.name === part) || null;
    }

    return current;
  }

  return {
    __YSP_TAURI_BRIDGE__: {
      async invoke(command, payload = {}) {
        switch (command) {
          case 'ysp_select_repository':
            return rootHandle;
          case 'ysp_restore_repository':
            return payload.handle || null;
          case 'ysp_list_directory':
            return payload.handle.entries.map((entry) => ({
              name: entry.name,
              kind: entry.kind,
              handle: entry
            }));
          case 'ysp_read_text_file':
            return payload.handle.content;
          case 'ysp_read_file_metadata':
            return {
              size: payload.handle.size ?? payload.handle.content?.length ?? 0
            };
          case 'ysp_resolve_path': {
            const resolved = findPathHandle(payload.rootHandle, payload.path);
            if (!resolved) {
              throw new Error(`Path not found: ${payload.path}`);
            }
            return resolved;
          }
          case 'ysp_storage_get_item':
            return storage.has(payload.key) ? storage.get(payload.key) : null;
          case 'ysp_storage_set_item':
            storage.set(payload.key, payload.value);
            return null;
          case 'ysp_storage_remove_item':
            storage.delete(payload.key);
            return null;
          case 'ysp_copy_text':
            return { copied: true };
          case 'ysp_save_text':
            return {
              mode: 'save',
              fileName: payload.fileName || 'combined_files.txt'
            };
          case 'ysp_download_text':
            return {
              mode: 'download',
              fileName: payload.fileName || 'combined_files.txt'
            };
          case 'ysp_run_task':
            return payload.payload;
          default:
            throw new Error(`Unknown command: ${command}`);
        }
      }
    }
  };
}

test('resolveTauriBridgeSource recognizes supported bridge globals', () => {
  const directWindow = createWindowWithBridge();
  const tauriCoreInvoke = async () => null;
  const legacyInvoke = async () => null;

  assert.equal(resolveTauriBridgeSource(directWindow), directWindow.__YSP_TAURI_BRIDGE__);
  assert.equal(hasResolvableTauriBridgeSource(directWindow), true);

  assert.equal(
    resolveTauriBridgeSource({
      __TAURI__: {
        core: {
          invoke: tauriCoreInvoke
        }
      }
    }).invoke,
    tauriCoreInvoke
  );

  assert.equal(
    resolveTauriBridgeSource({
      __TAURI_INVOKE__: legacyInvoke
    }).invoke,
    legacyInvoke
  );
});

test('bootTauriEntry composes and exposes the Tauri app on window', async () => {
  const windowObject = createWindowWithBridge();

  const app = bootTauriEntry({ windowObject });
  await app.controller.selectRepository();
  app.controller.setFileSelection('src/index.ts', true);
  const combined = await app.controller.combineSelection();

  assert.equal(windowObject.yspTauriApp, app);
  assert.equal(app.controller.getState().session.host, 'tauri');
  assert.equal(combined.bundle.files.length, 1);
});

test('hasResolvableTauriBridgeSource returns false when no bridge is present', () => {
  assert.equal(hasResolvableTauriBridgeSource({}), false);
  assert.throws(() => resolveTauriBridgeSource({}), /No Tauri bridge was found/);
});

test('waitForResolvableTauriBridgeSource resolves when the bridge appears shortly after startup', async () => {
  const windowObject = {};

  setTimeout(() => {
    windowObject.__TAURI_INVOKE__ = async () => null;
  }, 10);

  const bridge = await waitForResolvableTauriBridgeSource({
    windowObject,
    timeoutMs: 250,
    pollIntervalMs: 5
  });

  assert.equal(typeof bridge.invoke, 'function');
});

test('bootTauriUiWhenReady waits for a delayed bridge before booting the UI module', async () => {
  const events = [];
  const windowObject = {
    document: {
      getElementById() {
        return null;
      }
    }
  };

  const bootPromise = bootTauriUiWhenReady({
    windowObject,
    timeoutMs: 250,
    pollIntervalMs: 5,
    async loadBootModule() {
      events.push('load-module');
      return {
        bootTauriUI({ windowObject: bootWindowObject }) {
          events.push('boot-ui');
          return { bootWindowObject };
        }
      };
    }
  });

  setTimeout(() => {
    windowObject.__TAURI_INVOKE__ = async () => null;
    events.push('bridge-ready');
  }, 10);

  const result = await bootPromise;
  assert.deepEqual(events, ['bridge-ready', 'load-module', 'boot-ui']);
  assert.equal(result.bootWindowObject, windowObject);
});

test('bootTauriUiWhenReady reports a bridge timeout into the static shell when boot cannot complete', async () => {
  const statusElement = { className: '', textContent: '' };
  const diagnosticsElement = { textContent: '' };
  const windowObject = {
    document: {
      getElementById(id) {
        if (id === 'statusMessage') {
          return statusElement;
        }
        if (id === 'diagnosticsLog') {
          return diagnosticsElement;
        }
        return null;
      }
    }
  };

  await assert.rejects(
    bootTauriUiWhenReady({
      windowObject,
      timeoutMs: 20,
      pollIntervalMs: 5
    }),
    /No Tauri bridge was found/
  );

  assert.match(statusElement.className, /error/);
  assert.match(statusElement.textContent, /failed to initialize/i);
  assert.match(diagnosticsElement.textContent, /tauri-boot-error/);
});
