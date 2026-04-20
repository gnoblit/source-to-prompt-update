import test from 'node:test';
import assert from 'node:assert/strict';

import { bootElectronApp } from '../../apps/electron/src/main.js';
import { createElectronBridge } from '../../packages/host-impl-electron/src/electron-bridge.js';

function createFakeRepositoryHost() {
  return {
    canPersistRepositoryHandle() {
      return true;
    },
    async persistRepositoryHandle() {
      return true;
    },
    async hasPersistedRepositoryHandle() {
      return false;
    },
    async loadPersistedRepositoryHandle() {
      return null;
    },
    async clearPersistedRepositoryHandle() {},
    canSerializeRepositoryHandle() {
      return true;
    },
    async serializeRepositoryHandle(handle) {
      return handle ? JSON.parse(JSON.stringify(handle)) : null;
    },
    async selectRepository() {
      return { name: 'project', kind: 'directory' };
    },
    async restoreRepository(handle) {
      return handle || null;
    },
    async listDirectory() {
      return [];
    },
    async readTextFile() {
      return '';
    },
    async readFileMetadata() {
      return { size: 0 };
    },
    async resolvePath() {
      return null;
    }
  };
}

function createFakePersistenceHost() {
  return {
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {}
  };
}

function createFakeTaskHost() {
  return {
    async runTask() {
      return null;
    },
    async runInlineTask(task, payload) {
      return task(payload);
    }
  };
}

function createFakeOutputHost() {
  return {
    async copyText() {},
    async saveText() {
      return { mode: 'save', fileName: 'combined_files.txt' };
    },
    async downloadText() {
      return { mode: 'download', fileName: 'combined_files.txt' };
    }
  };
}

function createFakeDiagnosticsHost() {
  const entries = [];

  return {
    append(entry) {
      entries.push(entry);
    },
    clear() {
      entries.length = 0;
    },
    exportEntries() {
      return [...entries];
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

function createBridgeBackend(rootHandle) {
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
          return { copied: true };
        case 'saveText':
          return {
            mode: 'save',
            fileName: payload.fileName || 'combined_files.txt'
          };
        case 'downloadText':
          return {
            mode: 'download',
            fileName: payload.fileName || 'combined_files.txt'
          };
        case 'runTask':
          return payload.payload;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
  };
}

test('bootElectronApp creates a controller against validated host adapters', () => {
  const app = bootElectronApp({
    repositoryHost: createFakeRepositoryHost(),
    persistenceHost: createFakePersistenceHost(),
    taskHost: createFakeTaskHost(),
    outputHost: createFakeOutputHost(),
    diagnosticsHost: createFakeDiagnosticsHost()
  });

  assert.equal(typeof app.controller.selectRepository, 'function');
  assert.equal(app.controller.getState().session.host, 'electron');
  assert.equal(typeof app.hosts.outputHost.saveText, 'function');
});

test('bootElectronApp rejects missing host adapters early', () => {
  assert.throws(
    () =>
      bootElectronApp({
        repositoryHost: createFakeRepositoryHost(),
        persistenceHost: createFakePersistenceHost(),
        taskHost: createFakeTaskHost(),
        outputHost: createFakeOutputHost()
      }),
    /DiagnosticsHost is missing required method/
  );
});

test('bootElectronApp can compose hosts from an Electron bridge and run controller workflows', async () => {
  const backend = createBridgeBackend(
    createDirectory('project', [
      createDirectory('src', [
        createFile('index.ts', 'export const value = 1;\n'),
        createFile('util.ts', 'export const util = true;\n')
      ]),
      createFile('README.md', '# Title\n')
    ])
  );
  const bridge = createElectronBridge({ invoke: backend.invoke });

  const app = bootElectronApp({ bridge });

  await app.controller.selectRepository();
  app.controller.setFileSelection('src/index.ts', true);
  app.controller.setPromptOptions({
    includeGoal: true,
    goalText: 'Explain the entrypoint.'
  });

  const combined = await app.controller.combineSelection();
  const profile = await app.controller.saveProfile('Entrypoint');
  const loadedProfiles = await app.controller.loadProfiles();

  assert.equal(app.controller.getState().session.host, 'electron');
  assert.equal(combined.bundle.files.length, 1);
  assert.match(combined.renderedText, /Goal:\nExplain the entrypoint\./);
  assert.equal(profile.name, 'Entrypoint');
  assert.equal(loadedProfiles.profiles.length, 1);
});
