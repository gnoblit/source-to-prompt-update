import test from 'node:test';
import assert from 'node:assert/strict';

import { assertDiagnosticsHost } from '../../packages/host-contracts/src/diagnostics-host.js';
import { assertOutputHost } from '../../packages/host-contracts/src/output-host.js';
import { assertPersistenceHost } from '../../packages/host-contracts/src/persistence-host.js';
import { assertRepositoryHost } from '../../packages/host-contracts/src/repository-host.js';
import { assertTaskHost } from '../../packages/host-contracts/src/task-host.js';
import { BUILD_TRANSFORM_RESULT_TASK } from '../../packages/host-contracts/src/task-types.js';
import { createTauriBridge } from '../../packages/host-impl-tauri/src/tauri-bridge.js';
import { createTauriDiagnosticsHost } from '../../packages/host-impl-tauri/src/tauri-diagnostics-host.js';
import { createTauriOutputHost } from '../../packages/host-impl-tauri/src/tauri-output-host.js';
import { createTauriPersistenceHost } from '../../packages/host-impl-tauri/src/tauri-persistence-host.js';
import { createTauriRepositoryHost } from '../../packages/host-impl-tauri/src/tauri-repository-host.js';
import { createTauriTaskHost } from '../../packages/host-impl-tauri/src/tauri-task-host.js';
import { buildTransformResult } from '../../packages/core/src/transforms/transform-engine.js';

function createTauriBackend(rootHandle) {
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
          copiedTexts.push(payload.text);
          return { copied: true };
        case 'ysp_save_text': {
          const result = {
            mode: 'save',
            fileName: payload.fileName || 'combined_files.txt'
          };
          savedOutputs.push({ text: payload.text, fileName: result.fileName });
          return result;
        }
        case 'ysp_download_text': {
          const result = {
            mode: 'download',
            fileName: payload.fileName || 'combined_files.txt'
          };
          downloadedOutputs.push({ text: payload.text, fileName: result.fileName });
          return result;
        }
        case 'ysp_run_task':
          if (payload.taskType === 'uppercase') {
            return String(payload.payload).toUpperCase();
          }
          return payload.payload;
        default:
          throw new Error(`Unknown command: ${command}`);
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

test('Tauri host implementations satisfy the declared host contracts', async () => {
  const backend = createTauriBackend(createDirectory('project'));
  const bridge = createTauriBridge({ invoke: backend.invoke });

  assertRepositoryHost(createTauriRepositoryHost({ bridge }));
  assertPersistenceHost(createTauriPersistenceHost({ bridge }));
  assertTaskHost(createTauriTaskHost({ bridge }));
  assertOutputHost(createTauriOutputHost({ bridge }));
  assertDiagnosticsHost(createTauriDiagnosticsHost());
});

test('Tauri repository, persistence, output, and task hosts execute bridge-backed operations', async () => {
  const rootHandle = createDirectory('project', [
    createDirectory('src', [
      createFile('index.ts', 'export const value = 1;\n')
    ]),
    createFile('README.md', '# Title\n')
  ]);
  const backend = createTauriBackend(rootHandle);
  const bridge = createTauriBridge({ invoke: backend.invoke });

  const repositoryHost = createTauriRepositoryHost({ bridge });
  const persistenceHost = createTauriPersistenceHost({ bridge });
  const outputHost = createTauriOutputHost({ bridge });
  const taskHost = createTauriTaskHost({ bridge });

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
    payload: 'tauri'
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
  assert.equal(taskResult, 'TAURI');
});

test('Tauri diagnostics host retains bounded local history', () => {
  const snapshots = [];
  const diagnosticsHost = createTauriDiagnosticsHost({
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

test('Tauri repository host normalizes cancelled directory selection as AbortError', async () => {
  const bridge = createTauriBridge({
    async invoke(command) {
      if (command === 'ysp_select_repository') {
        return null;
      }
      throw new Error(`Unexpected command: ${command}`);
    }
  });

  const repositoryHost = createTauriRepositoryHost({ bridge });

  await assert.rejects(
    repositoryHost.selectRepository(),
    (error) => error?.name === 'AbortError' && /cancelled/i.test(error.message)
  );
});

test('Tauri output host normalizes cancelled save and download flows as AbortError', async () => {
  const bridge = createTauriBridge({
    async invoke(command) {
      if (command === 'ysp_save_text' || command === 'ysp_download_text') {
        return null;
      }
      throw new Error(`Unexpected command: ${command}`);
    }
  });

  const outputHost = createTauriOutputHost({ bridge });

  await assert.rejects(
    outputHost.saveText('hello', 'bundle.txt'),
    (error) => error?.name === 'AbortError' && /save/i.test(error.message)
  );

  await assert.rejects(
    outputHost.downloadText('hello', 'bundle.txt'),
    (error) => error?.name === 'AbortError' && /download/i.test(error.message)
  );
});

test('Tauri task host can prefer a local worker-backed task path before bridge fallback', async () => {
  const backend = createTauriBackend(createDirectory('project'));
  const bridge = createTauriBridge({ invoke: backend.invoke });
  const taskHost = createTauriTaskHost({
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
  assert.deepEqual(backend.copiedTexts, []);
});
