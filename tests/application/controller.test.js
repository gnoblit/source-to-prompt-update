import test from 'node:test';
import assert from 'node:assert/strict';

import { createAppController } from '../../packages/application/src/controller/create-app-controller.js';
import { createAppState } from '../../packages/application/src/state/create-app-state.js';
import {
  OUTPUT_COPY_BYTE_LIMIT,
  OUTPUT_PREVIEW_CHARACTER_LIMIT
} from '../../packages/core/src/output/output-presentation.js';

function createDirectory(name, entries = [], options = {}) {
  return {
    name,
    kind: 'directory',
    id: options.id || name,
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

function findPathHandle(rootHandle, targetPath) {
  const parts = targetPath.split('/');
  let current = rootHandle;

  for (const part of parts) {
    if (!current || current.kind !== 'directory') {
      return null;
    }
    current = current.entries.find((entry) => entry.name === part) || null;
  }

  return current;
}

function createFakeRepositoryHost(rootHandleRef) {
  return {
    canPersistRepositoryHandle() {
      return false;
    },
    async persistRepositoryHandle() {
      return false;
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
      return rootHandleRef.current;
    },
    async restoreRepository(handle) {
      return handle || rootHandleRef.current;
    },
    async listDirectory(handle) {
      return handle.entries.map((entry) => ({
        name: entry.name,
        kind: entry.kind,
        handle: entry
      }));
    },
    async readTextFile(handle) {
      return handle.content;
    },
    async readFileMetadata(handle) {
      return { size: handle.size };
    },
    async resolvePath(rootHandle, path) {
      const handle = findPathHandle(rootHandle, path);
      if (!handle) {
        throw new Error(`Path not found: ${path}`);
      }
      return handle;
    }
  };
}

function createFakeTaskHost() {
  return {
    async runTask() {
      throw new Error('runTask is not used in controller tests');
    },
    async runInlineTask(task, payload) {
      return task(payload);
    }
  };
}

function createFakePersistenceHost() {
  const storage = new Map();

  return {
    async getItem(key) {
      if (!storage.has(key)) {
        return null;
      }
      return JSON.parse(JSON.stringify(storage.get(key)));
    },
    async setItem(key, value) {
      storage.set(key, JSON.parse(JSON.stringify(value)));
    },
    async removeItem(key) {
      storage.delete(key);
    }
  };
}

test('controller exposes a live view model and subscription events', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createDirectory('src', [
        createFile('index.ts', 'export const value = 1;\n'),
        createFile('util.ts', 'export const util = true;\n')
      ]),
      createFile('README.md', '# Title\n')
    ])
  };

  const controller = createAppController({
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  const events = [];
  controller.subscribe((event) => {
    events.push(event.type);
  });

  await controller.selectRepository();

  let view = controller.getViewModel();
  assert.equal(view.treeView.visibleRows.some((row) => row.path === 'src'), true);
  assert.equal(view.combineEnabled, false);

  controller.toggleFolderExpansion('src');
  controller.setFileSelection('src/index.ts', true);
  controller.setFilterQuery('util');
  view = controller.getViewModel();

  assert.equal(view.combineEnabled, true);
  assert.deepEqual(
    view.treeView.visibleRows.map((row) => row.path),
    ['src', 'src/util.ts']
  );
  assert.equal(events.includes('repository-selected'), true);
  assert.equal(events.includes('file-selection-updated'), true);
  assert.equal(events.includes('filter-updated'), true);
});

test('controller supports folder selection and combine workflow', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createDirectory('src', [
        createFile('index.ts', 'const value = 1; // comment\n'),
        createFile('data.json', '{\n  "value": 1\n}\n')
      ])
    ])
  };

  const controller = createAppController({
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await controller.selectRepository();
  controller.toggleFolderExpansion('src');
  controller.setFolderSelection('src', true);
  controller.setTransformOptions({
    removeComments: true,
    minifyOutput: true
  });

  const result = await controller.combineSelection();
  const folderState = controller.getFolderCheckboxState('src');

  assert.equal(result.bundle.files.length, 2);
  assert.equal(folderState.checked, true);
  assert.match(result.renderedText, /\{"value":1\}/);
  assert.equal(result.renderedText.includes('// comment'), false);
  assert.equal(result.outputPresentation.previewTruncated, false);
  assert.equal(result.outputPresentation.copyAllowed, true);
  assert.equal(controller.getState().output.previewText, result.renderedText);
});

test('controller stores a truncated preview and disables copy for oversized output bundles', async () => {
  const largeContent = 'a'.repeat(OUTPUT_COPY_BYTE_LIMIT + 128);
  const rootHandleRef = {
    current: createDirectory('project', [createFile('large.txt', largeContent)])
  };

  const controller = createAppController({
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await controller.selectRepository();
  controller.setFileSelection('large.txt', true);

  const result = await controller.combineSelection();
  const outputState = controller.getState().output;

  assert.equal(result.outputPresentation.previewTruncated, true);
  assert.equal(result.outputPresentation.copyAllowed, false);
  assert.equal(outputState.copyAllowed, false);
  assert.equal(outputState.previewText.length < result.renderedText.length, true);
  assert.equal(outputState.previewText.includes('[Preview truncated.'), true);
  assert.equal(outputState.summaryText.includes('Clipboard copy is disabled'), true);
  assert.equal(outputState.previewText.length <= OUTPUT_PREVIEW_CHARACTER_LIMIT + 128, true);
});

test('controller clears generated output while preserving the selected file name', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [createFile('README.md', '# Title\n')])
  };
  const initialState = createAppState();
  initialState.output.fileName = 'notes.txt';

  const controller = createAppController({
    initialState,
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await controller.selectRepository();
  controller.setFileSelection('README.md', true);
  await controller.combineSelection();

  const clearedView = controller.clearOutput();
  const outputState = controller.getState().output;

  assert.equal(outputState.fileName, 'notes.txt');
  assert.equal(outputState.renderedText, '');
  assert.equal(outputState.previewText, '');
  assert.equal(outputState.copyAllowed, true);
  assert.equal(outputState.previewTruncated, false);
  assert.equal(outputState.summaryText, 'Combined output will appear here.');
  assert.equal(clearedView.output.fileName, 'notes.txt');
});

test('controller persists profiles and reapplies them against a rescanned repository', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createDirectory('src', [
        createFile('index.ts', 'export const value = 1;\n'),
        createFile('util.ts', 'export const util = true;\n')
      ]),
      createFile('README.md', '# Title\n')
    ])
  };
  const persistenceHost = createFakePersistenceHost();

  const firstController = createAppController({
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    persistenceHost,
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await firstController.selectRepository();
  firstController.toggleFolderExpansion('src');
  firstController.setFileSelection('src/index.ts', true);
  firstController.setPromptOptions({
    includeGoal: true,
    goalText: 'Explain the entrypoint.'
  });
  firstController.setTransformOptions({
    removeComments: true
  });

  const savedProfile = await firstController.saveProfile('Entrypoint Focus');

  const secondController = createAppController({
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    persistenceHost,
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await secondController.loadProfiles();

  rootHandleRef.current = createDirectory('project', [
    createDirectory('src', [
      createFile('index.ts', 'export const value = 2;\n')
    ])
  ]);

  await secondController.selectRepository();
  const applied = await secondController.loadProfile(savedProfile.id);
  const viewModel = secondController.getViewModel();

  assert.deepEqual([...secondController.getState().selection.selectedPaths], ['src/index.ts']);
  assert.deepEqual(applied.missingPaths, []);
  assert.equal(secondController.getState().options.includeGoal, true);
  assert.equal(secondController.getState().options.goalText, 'Explain the entrypoint.');
  assert.equal(secondController.getState().options.transforms.removeComments, true);
  assert.equal(viewModel.activeProfileId, savedProfile.id);

  const deleted = await secondController.deleteProfile(savedProfile.id);
  assert.equal(deleted.name, 'Entrypoint Focus');
  assert.equal(secondController.getViewModel().profiles.length, 0);
});

test('controller reports missing paths when loading a profile after repository changes', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createDirectory('src', [
        createFile('index.ts', 'export const value = 1;\n'),
        createFile('util.ts', 'export const util = true;\n')
      ])
    ])
  };
  const persistenceHost = createFakePersistenceHost();
  const controller = createAppController({
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    persistenceHost,
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await controller.selectRepository();
  controller.setFileSelection('src/index.ts', true);
  controller.setFileSelection('src/util.ts', true);

  const profile = await controller.saveProfile('Two Files');

  rootHandleRef.current = createDirectory('project', [
    createDirectory('src', [createFile('index.ts', 'export const value = 2;\n')])
  ]);

  await controller.selectRepository();
  const applied = await controller.loadProfile(profile.id);

  assert.deepEqual([...controller.getState().selection.selectedPaths], ['src/index.ts']);
  assert.deepEqual(applied.missingPaths, ['src/util.ts']);
});

test('controller requires a loaded repository before saving a profile', async () => {
  const controller = createAppController({
    repositoryHost: createFakeRepositoryHost({
      current: createDirectory('project', [])
    }),
    persistenceHost: createFakePersistenceHost(),
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await assert.rejects(
    controller.saveProfile('Empty'),
    /Load a repository before saving a profile/
  );
});

test('controller can remember and restore a saved repository through persistence', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createDirectory('src', [createFile('index.ts', 'export const value = 1;\n')]),
      createFile('README.md', '# Title\n')
    ])
  };
  const persistenceHost = createFakePersistenceHost();
  const controller = createAppController({
    repositoryHost: createFakeRepositoryHost(rootHandleRef),
    persistenceHost,
    taskHost: createFakeTaskHost(),
    host: 'electron'
  });

  assert.equal(controller.supportsSavedRepositoryRestore(), true);
  assert.equal(await controller.hasSavedRepository(), false);

  await controller.selectRepository();
  const remembered = await controller.rememberCurrentRepository();

  assert.deepEqual(remembered, { saved: true, reason: 'stored' });
  assert.equal(await controller.hasSavedRepository(), true);

  const restored = await controller.restoreSavedRepository({ allowPrompt: true });
  assert.equal(restored.restored, true);
  assert.equal(controller.getState().repository.snapshot.rootName, 'project');
  assert.equal(controller.getState().repository.snapshot.index.textFilesByPath.has('src/index.ts'), true);
});

test('controller reports missing or unsupported saved-repository restore states cleanly', async () => {
  const unsupportedController = createAppController({
    repositoryHost: {
      canPersistRepositoryHandle() {
        return false;
      },
      async persistRepositoryHandle() {
        return false;
      },
      async hasPersistedRepositoryHandle() {
        return false;
      },
      async loadPersistedRepositoryHandle() {
        return null;
      },
      async clearPersistedRepositoryHandle() {},
      canSerializeRepositoryHandle() {
        return false;
      },
      async serializeRepositoryHandle() {
        return null;
      },
      async selectRepository() {
        return createDirectory('project', []);
      },
      async restoreRepository() {
        return null;
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
    },
    persistenceHost: createFakePersistenceHost(),
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  assert.equal(unsupportedController.supportsSavedRepositoryRestore(), false);
  assert.deepEqual(await unsupportedController.rememberCurrentRepository(), {
    saved: false,
    reason: 'unsupported'
  });
  assert.deepEqual(await unsupportedController.restoreSavedRepository(), {
    restored: false,
    reason: 'unsupported'
  });

  const supportedController = createAppController({
    repositoryHost: createFakeRepositoryHost({
      current: createDirectory('project', [])
    }),
    persistenceHost: createFakePersistenceHost(),
    taskHost: createFakeTaskHost(),
    host: 'electron'
  });

  assert.deepEqual(await supportedController.restoreSavedRepository(), {
    restored: false,
    reason: 'missing'
  });
});

test('controller prefers host-native repository-handle persistence when available', async () => {
  const rootHandle = createDirectory('project', [
    createFile('README.md', '# Title\n')
  ]);
  const storedHandles = new Map();
  const repositoryHost = {
    canPersistRepositoryHandle() {
      return true;
    },
    async persistRepositoryHandle(handle) {
      storedHandles.set('lastRepositoryHandle', handle);
      return true;
    },
    async hasPersistedRepositoryHandle() {
      return storedHandles.has('lastRepositoryHandle');
    },
    async loadPersistedRepositoryHandle() {
      return storedHandles.get('lastRepositoryHandle') || null;
    },
    async clearPersistedRepositoryHandle() {
      storedHandles.delete('lastRepositoryHandle');
    },
    canSerializeRepositoryHandle() {
      return false;
    },
    async serializeRepositoryHandle() {
      return null;
    },
    async selectRepository() {
      return rootHandle;
    },
    async restoreRepository(handle) {
      return handle;
    },
    async listDirectory(handle) {
      return handle.entries.map((entry) => ({
        name: entry.name,
        kind: entry.kind,
        handle: entry
      }));
    },
    async readTextFile(handle) {
      return handle.content;
    },
    async readFileMetadata(handle) {
      return { size: handle.size };
    },
    async resolvePath(root, path) {
      return findPathHandle(root, path);
    }
  };

  const controller = createAppController({
    repositoryHost,
    persistenceHost: createFakePersistenceHost(),
    taskHost: createFakeTaskHost(),
    host: 'browser'
  });

  await controller.selectRepository();
  assert.equal(controller.supportsSavedRepositoryRestore(), true);
  assert.equal(await controller.hasSavedRepository(), false);

  const remembered = await controller.rememberCurrentRepository();
  assert.deepEqual(remembered, { saved: true, reason: 'stored' });
  assert.equal(await controller.hasSavedRepository(), true);

  const restored = await controller.restoreSavedRepository();
  assert.equal(restored.restored, true);
  assert.equal(controller.getState().repository.snapshot.rootName, 'project');
});
