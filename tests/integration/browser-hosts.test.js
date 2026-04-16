import test from 'node:test';
import assert from 'node:assert/strict';

import { assertDiagnosticsHost } from '../../packages/host-contracts/src/diagnostics-host.js';
import { assertOutputHost } from '../../packages/host-contracts/src/output-host.js';
import { assertPersistenceHost } from '../../packages/host-contracts/src/persistence-host.js';
import { assertRepositoryHost } from '../../packages/host-contracts/src/repository-host.js';
import { assertTaskHost } from '../../packages/host-contracts/src/task-host.js';
import { BUILD_TRANSFORM_RESULT_TASK } from '../../packages/host-contracts/src/task-types.js';
import { createBrowserDiagnosticsHost } from '../../packages/host-impl-browser/src/browser-diagnostics-host.js';
import { createBrowserOutputHost } from '../../packages/host-impl-browser/src/browser-output-host.js';
import { createBrowserPersistenceHost } from '../../packages/host-impl-browser/src/browser-persistence-host.js';
import { createBrowserRepositoryHost } from '../../packages/host-impl-browser/src/browser-repository-host.js';
import { createBrowserTaskHost } from '../../packages/host-impl-browser/src/browser-task-host.js';
import { buildTransformResult } from '../../packages/core/src/transforms/transform-engine.js';

function createStorage() {
  const map = new Map();

  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

function createRepositoryHandleStore() {
  const map = new Map();

  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
    async has(key) {
      return map.has(key);
    }
  };
}

function createFileHandle(name, content, options = {}) {
  return {
    name,
    kind: 'file',
    async getFile() {
      return {
        size: options.size ?? content.length,
        type: options.type ?? 'text/plain',
        lastModified: options.lastModified ?? 1,
        async text() {
          return content;
        }
      };
    }
  };
}

function createDirectoryHandle(name, entries = [], options = {}) {
  const entryMap = new Map(entries.map((entry) => [entry.name, entry]));

  return {
    name,
    kind: 'directory',
    async *values() {
      for (const entry of entryMap.values()) {
        yield entry;
      }
    },
    async getDirectoryHandle(childName) {
      const entry = entryMap.get(childName);
      if (!entry || entry.kind !== 'directory') {
        throw new Error(`Directory not found: ${childName}`);
      }
      return entry;
    },
    async getFileHandle(childName) {
      const entry = entryMap.get(childName);
      if (!entry || entry.kind !== 'file') {
        throw new Error(`File not found: ${childName}`);
      }
      return entry;
    },
    async queryPermission() {
      return options.queryPermission ?? 'granted';
    },
    async requestPermission() {
      return options.requestPermission ?? 'granted';
    }
  };
}

test('browser host implementations satisfy the declared host contracts', async () => {
  const windowObject = {
    showDirectoryPicker: async () => createDirectoryHandle('project'),
    navigator: {
      clipboard: {
        async writeText() {}
      }
    },
    URL: {
      createObjectURL() {
        return 'blob:test';
      },
      revokeObjectURL() {}
    },
    document: {
      createElement() {
        return {
          click() {},
          remove() {}
        };
      },
      body: {
        appendChild() {}
      }
    }
  };

  assertRepositoryHost(createBrowserRepositoryHost({ windowObject }));
  assertPersistenceHost(createBrowserPersistenceHost({ storage: createStorage() }));
  assertTaskHost(createBrowserTaskHost());
  assertOutputHost(createBrowserOutputHost({ windowObject }));
  assertDiagnosticsHost(createBrowserDiagnosticsHost());
});

test('browser repository host supports picker fallback, restore, listing, reads, and path resolution', async () => {
  const srcDirectory = createDirectoryHandle('src', [
    createFileHandle('index.ts', 'export const value = 1;\n')
  ]);
  const rootHandle = createDirectoryHandle(
    'project',
    [srcDirectory, createFileHandle('README.md', '# Title\n')],
    {
      queryPermission: 'prompt',
      requestPermission: 'granted'
    }
  );

  let callCount = 0;
  const windowObject = {
    async showDirectoryPicker(options) {
      callCount += 1;
      if (callCount === 1) {
        const error = new Error('Access to protected system folder was not allowed');
        error.name = 'AbortError';
        throw error;
      }
      assert.deepEqual(options, { mode: 'read' });
      return rootHandle;
    }
  };

  const repositoryHandleStore = createRepositoryHandleStore();
  const host = createBrowserRepositoryHost({ windowObject, repositoryHandleStore });
  assert.equal(host.canSerializeRepositoryHandle(), false);
  assert.equal(host.canPersistRepositoryHandle(), true);
  const selected = await host.selectRepository();
  assert.equal(await host.serializeRepositoryHandle(selected), null);
  assert.equal(await host.hasPersistedRepositoryHandle(), false);
  assert.equal(await host.persistRepositoryHandle(selected), true);
  assert.equal(await host.hasPersistedRepositoryHandle(), true);
  assert.equal(await host.loadPersistedRepositoryHandle(), rootHandle);
  const restored = await host.restoreRepository(rootHandle, { allowPrompt: true });
  const entries = await host.listDirectory(selected);
  const readmeHandle = await host.resolvePath(selected, 'README.md');
  const nestedHandle = await host.resolvePath(selected, 'src/index.ts');
  const readmeText = await host.readTextFile(readmeHandle);
  const metadata = await host.readFileMetadata(nestedHandle);

  assert.equal(selected, rootHandle);
  assert.equal(restored, rootHandle);
  assert.deepEqual(
    entries.map((entry) => `${entry.kind}:${entry.name}`),
    ['directory:src', 'file:README.md']
  );
  assert.equal(readmeText, '# Title\n');
  assert.equal(metadata.size, 'export const value = 1;\n'.length);
  await host.clearPersistedRepositoryHandle();
  assert.equal(await host.hasPersistedRepositoryHandle(), false);
});

test('browser persistence, diagnostics, task, and output hosts behave predictably', async () => {
  const storage = createStorage();
  const persistenceHost = createBrowserPersistenceHost({ storage });
  const diagnosticsSnapshots = [];
  const diagnosticsHost = createBrowserDiagnosticsHost({
    maxEntries: 2,
    onChange(entries) {
      diagnosticsSnapshots.push(entries);
    }
  });

  let copiedText = null;
  let clickedAnchors = 0;
  let appendedAnchors = 0;
  let revokedUrl = null;
  const saveWrites = [];

  const windowObject = {
    navigator: {
      clipboard: {
        async writeText(text) {
          copiedText = text;
        }
      }
    },
    URL: {
      createObjectURL() {
        return 'blob:download';
      },
      revokeObjectURL(url) {
        revokedUrl = url;
      }
    },
    document: {
      createElement() {
        return {
          click() {
            clickedAnchors += 1;
          },
          remove() {}
        };
      },
      body: {
        appendChild() {
          appendedAnchors += 1;
        }
      }
    },
    async showSaveFilePicker() {
      return {
        name: 'saved.txt',
        async createWritable() {
          return {
            async write(text) {
              saveWrites.push(text);
            },
            async close() {}
          };
        }
      };
    }
  };

  const outputHost = createBrowserOutputHost({ windowObject });
  const taskHost = createBrowserTaskHost();

  await persistenceHost.setItem('profiles', [{ id: 'one', name: 'One' }]);
  assert.deepEqual(await persistenceHost.getItem('profiles'), [{ id: 'one', name: 'One' }]);

  diagnosticsHost.append({ event: 'one' });
  diagnosticsHost.append({ event: 'two' });
  diagnosticsHost.append({ event: 'three' });
  assert.deepEqual(diagnosticsHost.exportEntries(), [{ event: 'two' }, { event: 'three' }]);
  diagnosticsHost.clear();
  assert.deepEqual(diagnosticsHost.exportEntries(), []);
  assert.equal(diagnosticsSnapshots.length >= 3, true);

  const taskResult = await taskHost.runInlineTask((value) => value * 2, 21);
  assert.equal(taskResult, 42);

  await outputHost.copyText('hello');
  const download = await outputHost.downloadText('download me', 'report');
  const saved = await outputHost.saveText('save me', 'saved');

  assert.equal(copiedText, 'hello');
  assert.equal(download.fileName, 'report.txt');
  assert.equal(saved.mode, 'save');
  assert.equal(saved.fileName, 'saved.txt');
  assert.deepEqual(saveWrites, ['save me']);
  assert.equal(appendedAnchors, 1);
  assert.equal(clickedAnchors, 1);
  assert.equal(revokedUrl, 'blob:download');
});

test('browser task host can execute transform work through an injected worker factory', async () => {
  const taskHost = createBrowserTaskHost({
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

  assert.equal(result.plan.executionStrategy, 'inline');
  assert.equal(result.transformedFiles[0].content.includes('// comment'), false);
});
