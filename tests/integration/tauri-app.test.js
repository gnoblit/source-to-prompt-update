import test from 'node:test';
import assert from 'node:assert/strict';

import { bootTauriApp } from '../../apps/tauri/src/main.js';
import { createTauriBridge } from '../../packages/host-impl-tauri/src/tauri-bridge.js';

function createFakeRepositoryHost() {
  return {
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
      return { fileName: 'combined_files.txt' };
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
  };
}

test('bootTauriApp creates a controller against validated host adapters', () => {
  const app = bootTauriApp({
    repositoryHost: createFakeRepositoryHost(),
    persistenceHost: createFakePersistenceHost(),
    taskHost: createFakeTaskHost(),
    outputHost: createFakeOutputHost(),
    diagnosticsHost: createFakeDiagnosticsHost()
  });

  assert.equal(typeof app.controller.selectRepository, 'function');
  assert.equal(app.controller.getState().session.host, 'tauri');
  assert.equal(typeof app.hosts.outputHost.saveText, 'function');
});

test('bootTauriApp rejects missing host adapters early', () => {
  assert.throws(
    () =>
      bootTauriApp({
        repositoryHost: createFakeRepositoryHost(),
        persistenceHost: createFakePersistenceHost(),
        taskHost: createFakeTaskHost(),
        outputHost: createFakeOutputHost()
      }),
    /DiagnosticsHost is missing required method/
  );
});

test('bootTauriApp can compose hosts from a Tauri bridge and run controller workflows', async () => {
  const backend = createBridgeBackend(
    createDirectory('project', [
      createDirectory('src', [
        createFile('index.ts', 'export const value = 1;\n'),
        createFile('util.ts', 'export const util = true;\n')
      ]),
      createFile('README.md', '# Title\n')
    ])
  );
  const bridge = createTauriBridge({ invoke: backend.invoke });

  const app = bootTauriApp({ bridge });

  await app.controller.selectRepository();
  app.controller.setFileSelection('src/index.ts', true);
  app.controller.setPromptOptions({
    includeGoal: true,
    goalText: 'Explain the entrypoint.'
  });

  const combined = await app.controller.combineSelection();
  const profile = await app.controller.saveProfile('Entrypoint');
  const loadedProfiles = await app.controller.loadProfiles();

  assert.equal(app.controller.getState().session.host, 'tauri');
  assert.equal(combined.bundle.files.length, 1);
  assert.match(combined.renderedText, /Goal:\nExplain the entrypoint\./);
  assert.equal(profile.name, 'Entrypoint');
  assert.equal(loadedProfiles.profiles.length, 1);
});
