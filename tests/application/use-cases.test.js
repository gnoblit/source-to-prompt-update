import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTransformResult } from '../../packages/core/src/transforms/transform-engine.js';
import { createAppState } from '../../packages/application/src/state/create-app-state.js';
import {
  combineSelection,
  refreshRepository,
  scanSelectedRepository
} from '../../packages/application/src/use-cases/index.js';

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
  const calls = {
    runTask: [],
    runInlineTask: []
  };

  return {
    calls,
    async runTask({ taskType, payload }) {
      calls.runTask.push({ taskType, payload });
      return buildTransformResult(payload);
    },
    async runInlineTask(task, payload) {
      calls.runInlineTask.push({ task, payload });
      return task(payload);
    }
  };
}

test('scanSelectedRepository stores a snapshot and repository handle in application state', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createDirectory('src', [createFile('index.ts', 'export const value = 1;\n')]),
      createFile('README.md', '# Title\n')
    ])
  };
  const host = createFakeRepositoryHost(rootHandleRef);

  const { nextState } = await scanSelectedRepository({
    state: createAppState(),
    repositoryHost: host,
    rootHandle: rootHandleRef.current,
    host: 'browser'
  });

  assert.equal(nextState.session.host, 'browser');
  assert.equal(nextState.session.repositoryHandle, rootHandleRef.current);
  assert.equal(nextState.repository.snapshot.rootName, 'project');
  assert.equal(nextState.repository.snapshot.index.textFilesByPath.has('src/index.ts'), true);
});

test('refreshRepository preserves valid selections across rescans', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createFile('README.md', '# Title\n'),
      createDirectory('src', [createFile('index.ts', 'export const value = 1;\n')])
    ])
  };
  const host = createFakeRepositoryHost(rootHandleRef);

  const initial = await scanSelectedRepository({
    state: createAppState(),
    repositoryHost: host,
    rootHandle: rootHandleRef.current,
    host: 'browser'
  });

  initial.nextState.selection.selectedPaths.add('README.md');
  initial.nextState.selection.selectedPaths.add('src/index.ts');
  initial.nextState.selection.filterSelectedPaths.add('src/index.ts');

  rootHandleRef.current = createDirectory('project', [
    createDirectory('src', [createFile('index.ts', 'export const value = 2;\n')])
  ]);
  initial.nextState.session.repositoryHandle = rootHandleRef.current;

  const refreshed = await refreshRepository({
    state: initial.nextState,
    repositoryHost: host
  });

  assert.deepEqual([...refreshed.nextState.selection.selectedPaths], ['src/index.ts']);
  assert.deepEqual([...refreshed.nextState.selection.filterSelectedPaths], ['src/index.ts']);
});

test('combineSelection builds a prompt bundle and rendered text for selected files', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createDirectory('src', [createFile('index.ts', 'export const value = 1;\n')]),
      createFile('README.md', '# Title\n')
    ])
  };
  const host = createFakeRepositoryHost(rootHandleRef);

  const scanned = await scanSelectedRepository({
    state: createAppState(),
    repositoryHost: host,
    rootHandle: rootHandleRef.current,
    host: 'browser'
  });

  scanned.nextState.selection.selectedPaths.add('src/index.ts');
  scanned.nextState.options.includePreamble = true;
  scanned.nextState.options.customPreamble = 'Here is the repository.';
  scanned.nextState.options.includeGoal = true;
  scanned.nextState.options.goalText = 'Explain the code.';

  const result = await combineSelection({
    state: scanned.nextState,
    repositoryHost: host
  });

  assert.equal(result.bundle.files.length, 1);
  assert.match(result.renderedText, /Here is the repository\./);
  assert.match(result.renderedText, /Goal:\nExplain the code\./);
  assert.match(result.renderedText, /src\/index\.ts/);
});

test('combineSelection applies transforms through the task host when enabled', async () => {
  const rootHandleRef = {
    current: createDirectory('project', [
      createFile('data.json', '{\n  "value": 1\n}\n'),
      createDirectory('src', [
        createFile('index.ts', 'const value = 1; // comment\n')
      ])
    ])
  };
  const host = createFakeRepositoryHost(rootHandleRef);

  const scanned = await scanSelectedRepository({
    state: createAppState(),
    repositoryHost: host,
    rootHandle: rootHandleRef.current,
    host: 'browser'
  });

  scanned.nextState.selection.selectedPaths.add('data.json');
  scanned.nextState.selection.selectedPaths.add('src/index.ts');
  scanned.nextState.options.transforms.removeComments = true;
  scanned.nextState.options.transforms.minifyOutput = true;

  const result = await combineSelection({
    state: scanned.nextState,
    repositoryHost: host,
    taskHost: createFakeTaskHost()
  });

  assert.equal(result.transformPlan.transforms.length, 2);
  assert.equal(result.transformExecution.mode, 'inline');
  assert.equal(result.transformExecution.usedTaskHost, true);
  assert.equal(result.transformExecution.fallbackUsed, false);
  assert.equal(result.bundle.transformProvenance.length, 2);
  assert.equal(result.bundle.warnings.length >= 1, true);
  assert.match(result.renderedText, /\{"value":1\}/);
  assert.equal(result.renderedText.includes('// comment'), false);
});

test('combineSelection prefers taskHost.runTask for background-preferred transform work', async () => {
  const manyFiles = Array.from({ length: 24 }, (_, index) =>
    createFile(`file-${index}.ts`, `const value${index} = 1; // comment\n`)
  );
  const rootHandleRef = {
    current: createDirectory('project', [createDirectory('src', manyFiles)])
  };
  const host = createFakeRepositoryHost(rootHandleRef);
  const taskHost = createFakeTaskHost();

  const scanned = await scanSelectedRepository({
    state: createAppState(),
    repositoryHost: host,
    rootHandle: rootHandleRef.current,
    host: 'browser'
  });

  for (let index = 0; index < manyFiles.length; index += 1) {
    scanned.nextState.selection.selectedPaths.add(`src/file-${index}.ts`);
  }
  scanned.nextState.options.transforms.removeComments = true;

  const result = await combineSelection({
    state: scanned.nextState,
    repositoryHost: host,
    taskHost
  });

  assert.equal(result.transformPlan.executionStrategy, 'background-preferred');
  assert.equal(result.transformExecution.mode, 'background');
  assert.equal(result.transformExecution.fallbackUsed, false);
  assert.equal(taskHost.calls.runTask.length, 1);
  assert.equal(taskHost.calls.runInlineTask.length, 0);
});

test('combineSelection falls back to runInlineTask when background task execution fails', async () => {
  const manyFiles = Array.from({ length: 24 }, (_, index) =>
    createFile(`file-${index}.ts`, `const value${index} = 1; // comment\n`)
  );
  const rootHandleRef = {
    current: createDirectory('project', [createDirectory('src', manyFiles)])
  };
  const host = createFakeRepositoryHost(rootHandleRef);
  const taskHost = {
    calls: {
      runTask: 0,
      runInlineTask: 0
    },
    async runTask() {
      taskHost.calls.runTask += 1;
      throw new Error('worker unavailable');
    },
    async runInlineTask(task, payload) {
      taskHost.calls.runInlineTask += 1;
      return task(payload);
    }
  };

  const scanned = await scanSelectedRepository({
    state: createAppState(),
    repositoryHost: host,
    rootHandle: rootHandleRef.current,
    host: 'browser'
  });

  for (let index = 0; index < manyFiles.length; index += 1) {
    scanned.nextState.selection.selectedPaths.add(`src/file-${index}.ts`);
  }
  scanned.nextState.options.transforms.removeComments = true;

  const result = await combineSelection({
    state: scanned.nextState,
    repositoryHost: host,
    taskHost
  });

  assert.equal(result.transformPlan.executionStrategy, 'background-preferred');
  assert.equal(result.transformExecution.mode, 'inline');
  assert.equal(result.transformExecution.fallbackUsed, true);
  assert.equal(taskHost.calls.runTask, 1);
  assert.equal(taskHost.calls.runInlineTask, 1);
  assert.equal(result.renderedText.includes('// comment'), false);
});
