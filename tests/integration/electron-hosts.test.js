import test from 'node:test';
import assert from 'node:assert/strict';

import { assertDiagnosticsHost } from '../../packages/host-contracts/src/diagnostics-host.js';
import { assertOutputHost } from '../../packages/host-contracts/src/output-host.js';
import { assertPersistenceHost } from '../../packages/host-contracts/src/persistence-host.js';
import { assertRepositoryHost } from '../../packages/host-contracts/src/repository-host.js';
import { assertTaskHost } from '../../packages/host-contracts/src/task-host.js';
import { BUILD_TRANSFORM_RESULT_TASK } from '../../packages/host-contracts/src/task-types.js';
import { buildTransformResult } from '../../packages/core/src/transforms/transform-engine.js';
import { createElectronBridge } from '../../packages/host-impl-electron/src/electron-bridge.js';
import { createElectronDiagnosticsHost } from '../../packages/host-impl-electron/src/electron-diagnostics-host.js';
import { createElectronOutputHost } from '../../packages/host-impl-electron/src/electron-output-host.js';
import { createElectronPersistenceHost } from '../../packages/host-impl-electron/src/electron-persistence-host.js';
import { createElectronRepositoryHost } from '../../packages/host-impl-electron/src/electron-repository-host.js';
import { createElectronTaskHost } from '../../packages/host-impl-electron/src/electron-task-host.js';

function createElectronBackend(rootHandle) {
  const storage = new Map();
  const copiedTexts = [];
  const savedOutputs = [];
  const downloadedOutputs = [];

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
    storage,
    copiedTexts,
    savedOutputs,
    downloadedOutputs,

    async invoke(operation, payload = {}) {
      switch (operation) {
        case 'selectRepository':
          return rootHandle;
        case 'restoreRepository':
          return payload.handle || null;
        case 'listDirectory':
          return payload.handle.entries.map((entry) => ({
            name: entry.name,
            kind: entry.kind,
            handle: entry
          }));
        case 'readTextFile':
          return payload.handle.content;
        case 'readFileMetadata':
          return {
            size: payload.handle.size ?? payload.handle.content?.length ?? 0
          };
        case 'resolvePath': {
          const resolved = findPathHandle(payload.rootHandle, payload.path);
          if (!resolved) {
            throw new Error(`Path not found: ${payload.path}`);
          }
          return resolved;
        }
        case 'getItem':
          return storage.has(payload.key) ? storage.get(payload.key) : null;
        case 'setItem':
          storage.set(payload.key, payload.value);
          return null;
        case 'removeItem':
          storage.delete(payload.key);
          return null;
        case 'copyText':
          copiedTexts.push(payload.text);
          return { copied: true };
        case 'saveText': {
          const result = {
            mode: 'save',
            fileName: payload.fileName || 'combined_files.txt'
          };
          savedOutputs.push({ text: payload.text, fileName: result.fileName });
          return result;
        }
        case 'downloadText': {
          const result = {
            mode: 'download',
            fileName: payload.fileName || 'combined_files.txt'
          };
          downloadedOutputs.push({ text: payload.text, fileName: result.fileName });
          return result;
        }
        case 'runTask':
          if (payload.taskType === 'uppercase') {
            return String(payload.payload).toUpperCase();
          }
          return payload.payload;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
  };
}

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

test('Electron host implementations satisfy the declared host contracts', async () => {
  const backend = createElectronBackend(createDirectory('project'));
  const bridge = createElectronBridge({ invoke: backend.invoke });

  assertRepositoryHost(createElectronRepositoryHost({ bridge }));
  assertPersistenceHost(createElectronPersistenceHost({ bridge }));
  assertTaskHost(createElectronTaskHost({ bridge }));
  assertOutputHost(createElectronOutputHost({ bridge }));
  assertDiagnosticsHost(createElectronDiagnosticsHost());
});

test('Electron repository, persistence, output, and task hosts execute bridge-backed operations', async () => {
  const rootHandle = createDirectory('project', [
    createDirectory('src', [
      createFile('index.ts', 'export const value = 1;\n')
    ]),
    createFile('README.md', '# Title\n')
  ]);
  const backend = createElectronBackend(rootHandle);
  const bridge = createElectronBridge({ invoke: backend.invoke });

  const repositoryHost = createElectronRepositoryHost({ bridge });
  const persistenceHost = createElectronPersistenceHost({ bridge });
  const outputHost = createElectronOutputHost({ bridge });
  const taskHost = createElectronTaskHost({ bridge });

  assert.equal(repositoryHost.canSerializeRepositoryHandle(), true);
  const selected = await repositoryHost.selectRepository();
  const serialized = await repositoryHost.serializeRepositoryHandle(selected);
  const restored = await repositoryHost.restoreRepository(selected);
  const entries = await repositoryHost.listDirectory(selected);
  const nestedHandle = await repositoryHost.resolvePath(selected, 'src/index.ts');
  const text = await repositoryHost.readTextFile(nestedHandle);
  const metadata = await repositoryHost.readFileMetadata(nestedHandle);

  await persistenceHost.setItem('profiles', [{ id: 'one', name: 'One' }]);
  const profiles = await persistenceHost.getItem('profiles');
  await persistenceHost.removeItem('profiles');
  const removed = await persistenceHost.getItem('profiles');

  await outputHost.copyText('hello');
  const saved = await outputHost.saveText('save me', 'bundle.txt');
  const downloaded = await outputHost.downloadText('download me', 'bundle-download.txt');

  const taskResult = await taskHost.runTask({
    taskType: 'uppercase',
    payload: 'electron'
  });

  assert.equal(selected, rootHandle);
  assert.deepEqual(serialized, rootHandle);
  assert.equal(restored, rootHandle);
  assert.deepEqual(
    entries.map((entry) => `${entry.kind}:${entry.name}`),
    ['directory:src', 'file:README.md']
  );
  assert.equal(text, 'export const value = 1;\n');
  assert.equal(metadata.size, 'export const value = 1;\n'.length);
  assert.deepEqual(profiles, [{ id: 'one', name: 'One' }]);
  assert.equal(removed, null);
  assert.equal(saved.mode, 'save');
  assert.equal(downloaded.mode, 'download');
  assert.deepEqual(backend.copiedTexts, ['hello']);
  assert.equal(taskResult, 'ELECTRON');
});

test('Electron diagnostics host retains bounded local history', () => {
  const snapshots = [];
  const diagnosticsHost = createElectronDiagnosticsHost({
    maxEntries: 2,
    onChange(entries) {
      snapshots.push(entries);
    }
  });

  diagnosticsHost.append({ event: 'one' });
  diagnosticsHost.append({ event: 'two' });
  diagnosticsHost.append({ event: 'three' });

  assert.deepEqual(diagnosticsHost.exportEntries(), [{ event: 'two' }, { event: 'three' }]);
  diagnosticsHost.clear();
  assert.deepEqual(diagnosticsHost.exportEntries(), []);
  assert.equal(snapshots.length >= 3, true);
});

test('Electron repository host normalizes cancelled directory selection as AbortError', async () => {
  const bridge = createElectronBridge({
    async invoke(operation) {
      if (operation === 'selectRepository') {
        return null;
      }
      throw new Error(`Unexpected operation: ${operation}`);
    }
  });

  const repositoryHost = createElectronRepositoryHost({ bridge });

  await assert.rejects(
    repositoryHost.selectRepository(),
    (error) => error?.name === 'AbortError' && /cancelled/i.test(error.message)
  );
});

test('Electron output host normalizes cancelled save and download flows as AbortError', async () => {
  const bridge = createElectronBridge({
    async invoke(operation) {
      if (operation === 'saveText' || operation === 'downloadText') {
        return null;
      }
      throw new Error(`Unexpected operation: ${operation}`);
    }
  });

  const outputHost = createElectronOutputHost({ bridge });

  await assert.rejects(
    outputHost.saveText('hello', 'bundle.txt'),
    (error) => error?.name === 'AbortError' && /save/i.test(error.message)
  );

  await assert.rejects(
    outputHost.downloadText('hello', 'bundle.txt'),
    (error) => error?.name === 'AbortError' && /download/i.test(error.message)
  );
});

test('Electron task host can prefer a local worker-backed task path before bridge fallback', async () => {
  const backend = createElectronBackend(createDirectory('project'));
  const bridge = createElectronBridge({ invoke: backend.invoke });
  const taskHost = createElectronTaskHost({
    bridge,
    createWorkerForTask(taskType) {
      if (taskType !== BUILD_TRANSFORM_RESULT_TASK) {
        return null;
      }

      return () => {
        const listeners = {
          message: [],
          error: []
        };

        return {
          addEventListener(type, listener) {
            listeners[type].push(listener);
          },
          removeEventListener(type, listener) {
            listeners[type] = listeners[type].filter((entry) => entry !== listener);
          },
          terminate() {},
          postMessage(message) {
            buildTransformResult(message.payload)
              .then((result) => {
                for (const listener of listeners.message) {
                  listener({
                    data: {
                      ok: true,
                      result
                    }
                  });
                }
              })
              .catch((error) => {
                for (const listener of listeners.error) {
                  listener({
                    message: error.message
                  });
                }
              });
          }
        };
      };
    }
  });

  const result = await taskHost.runTask({
    taskType: BUILD_TRANSFORM_RESULT_TASK,
    payload: {
      selectedFiles: [
        {
          path: 'src/index.ts',
          content: 'const value = 1; // comment\n',
          size: 28,
          lines: 1
        }
      ],
      options: {
        removeComments: true,
        minifyOutput: false
      }
    }
  });

  assert.equal(result.transformedFiles[0].content.includes('// comment'), false);
});
