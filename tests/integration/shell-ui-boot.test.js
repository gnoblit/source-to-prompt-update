import test from 'node:test';
import assert from 'node:assert/strict';

import { createAppController } from '../../packages/application/src/controller/create-app-controller.js';
import { bootShellUI } from '../../packages/shell-ui/src/boot.js';

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = String(tagName).toUpperCase();
    this.id = id;
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    const styleMap = new Map();
    this.style = {
      setProperty(name, value) {
        styleMap.set(name, String(value));
      },
      getPropertyValue(name) {
        return styleMap.get(name) || '';
      }
    };
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.indeterminate = false;
  }

  appendChild(child) {
    this.children.push(child);

    if (this.tagName === 'SELECT' && child?.selected) {
      this.value = child.value;
    }

    return child;
  }

  replaceChildren(...children) {
    this.children = [...children];

    if (this.tagName === 'SELECT' && !this.children.some((child) => child.value === this.value)) {
      this.value = '';
    }
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(listener);
  }

  dispatchEvent(type, event = {}) {
    const listeners = this.listeners.get(type) || [];
    const dispatchedEvent = {
      target: this,
      currentTarget: this,
      preventDefault() {},
      ...event
    };

    for (const listener of listeners) {
      listener(dispatchedEvent);
    }
  }

  click() {
    this.dispatchEvent('click');
  }

  closest(selector) {
    if (
      selector === 'button[data-action="toggle-folder"]' &&
      this.tagName === 'BUTTON' &&
      this.dataset.action === 'toggle-folder'
    ) {
      return this;
    }

    return null;
  }

  get selectedOptions() {
    if (this.tagName !== 'SELECT') {
      return [];
    }

    return this.children.filter((child) => child.value === this.value || child.selected);
  }
}

function createShellDocument() {
  const tagById = new Map([
    ['selectFolderBtn', 'button'],
    ['restoreFolderBtn', 'button'],
    ['refreshFolderBtn', 'button'],
    ['toggleVisibleBtn', 'button'],
    ['clearSelectionBtn', 'button'],
    ['profileNameInput', 'input'],
    ['profileSelect', 'select'],
    ['saveProfileBtn', 'button'],
    ['loadProfileBtn', 'button'],
    ['deleteProfileBtn', 'button'],
    ['selectedRepositoryName', 'div'],
    ['scanPhaseText', 'div'],
    ['statusMessage', 'div'],
    ['selectedSizeText', 'div'],
    ['selectedLinesText', 'div'],
    ['visibleRowsText', 'div'],
    ['filterInput', 'input'],
    ['treeSummaryText', 'div'],
    ['treeList', 'div'],
    ['includePreamble', 'input'],
    ['preambleInput', 'textarea'],
    ['includeGoal', 'input'],
    ['goalInput', 'textarea'],
    ['removeCommentsToggle', 'input'],
    ['minifyOutputToggle', 'input'],
    ['combineBtn', 'button'],
    ['outputFileNameInput', 'input'],
    ['copyOutputBtn', 'button'],
    ['downloadOutputBtn', 'button'],
    ['saveOutputBtn', 'button'],
    ['outputTextarea', 'textarea'],
    ['copyDiagnosticsBtn', 'button'],
    ['clearDiagnosticsBtn', 'button'],
    ['diagnosticsLog', 'pre']
  ]);

  const elements = new Map(
    [...tagById.entries()].map(([id, tagName]) => [id, new FakeElement(tagName, id)])
  );

  return {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
}

function createWindowObject() {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }

      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!listeners.has(type)) {
        return;
      }

      listeners.set(
        type,
        listeners.get(type).filter((entry) => entry !== listener)
      );
    },
    dispatchEvent(type, event = {}) {
      for (const listener of listeners.get(type) || []) {
        listener(event);
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

function findPathHandle(rootHandle, targetPath) {
  const parts = String(targetPath)
    .split('/')
    .filter(Boolean);
  let current = rootHandle;

  for (const part of parts) {
    if (!current || current.kind !== 'directory') {
      return null;
    }

    current = current.entries.find((entry) => entry.name === part) || null;
  }

  return current;
}

function createPersistenceHost(initialEntries = []) {
  const storage = new Map(initialEntries);

  return {
    async getItem(key) {
      return storage.has(key) ? JSON.parse(JSON.stringify(storage.get(key))) : null;
    },
    async setItem(key, value) {
      storage.set(key, JSON.parse(JSON.stringify(value)));
    },
    async removeItem(key) {
      storage.delete(key);
    }
  };
}

function createRepositoryHost({ rootHandle, denySilentRestore = false, restoreCalls = [] }) {
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
      return rootHandle;
    },
    async restoreRepository(handle, options = {}) {
      restoreCalls.push(options);

      if (denySilentRestore && options.allowPrompt !== true) {
        return null;
      }

      return handle || rootHandle;
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
      return {
        size: handle.size ?? handle.content?.length ?? 0
      };
    },
    async resolvePath(baseHandle, path) {
      const resolved = findPathHandle(baseHandle, path);
      if (!resolved) {
        throw new Error(`Path not found: ${path}`);
      }
      return resolved;
    }
  };
}

function createTaskHost() {
  return {
    async runTask() {
      return null;
    },
    async runInlineTask(task, payload) {
      return task(payload);
    }
  };
}

function createOutputHost() {
  const copiedTexts = [];

  return {
    copiedTexts,
    async copyText(text) {
      copiedTexts.push(text);
    },
    async saveText(_text, fileName = 'combined_files.txt') {
      return { mode: 'save', fileName };
    },
    async downloadText(_text, fileName = 'combined_files.txt') {
      return { mode: 'download', fileName };
    }
  };
}

function createDiagnosticsHost({ onChange } = {}) {
  const entries = [];

  function publish() {
    onChange?.([...entries]);
  }

  return {
    append(entry) {
      entries.push(entry);
      publish();
    },
    clear() {
      entries.length = 0;
      publish();
    },
    exportEntries() {
      return [...entries];
    }
  };
}

function createBootApp({ rootHandle, persistedRepositoryHandle, denySilentRestore = false }) {
  const restoreCalls = [];
  const repositoryHost = createRepositoryHost({
    rootHandle,
    denySilentRestore,
    restoreCalls
  });
  const persistenceHost = createPersistenceHost(
    persistedRepositoryHandle
      ? [['ysp.repository.v1', persistedRepositoryHandle]]
      : []
  );
  const taskHost = createTaskHost();
  const outputHost = createOutputHost();
  let diagnosticsHost = createDiagnosticsHost();
  const controller = createAppController({
    repositoryHost,
    persistenceHost,
    taskHost,
    host: 'browser'
  });

  return {
    restoreCalls,
    outputHost,
    diagnosticsHost,
    bootApp({ onDiagnosticsChange } = {}) {
      diagnosticsHost = createDiagnosticsHost({
        onChange: onDiagnosticsChange
      });

      return {
        controller,
        hosts: {
          repositoryHost,
          persistenceHost,
          taskHost,
          outputHost,
          diagnosticsHost
        }
      };
    }
  };
}

async function flushAsyncWork(iterations = 4) {
  for (let index = 0; index < iterations; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test('bootShellUI silently restores a saved repository during startup when the host allows it', async () => {
  const rootHandle = createDirectory('project', [
    createDirectory('src', [createFile('index.ts', 'export const value = 1;\n')]),
    createFile('README.md', '# Title\n')
  ]);
  const documentObject = createShellDocument();
  const windowObject = createWindowObject();
  const harness = createBootApp({
    rootHandle,
    persistedRepositoryHandle: rootHandle
  });

  const app = bootShellUI({
    bootApp: harness.bootApp,
    documentObject,
    windowObject,
    storage: {}
  });

  await flushAsyncWork();

  assert.equal(app.controller.getState().repository.snapshot?.rootName, 'project');
  assert.deepEqual(harness.restoreCalls, [{ allowPrompt: false }]);
  assert.equal(
    documentObject.getElementById('selectedRepositoryName').textContent,
    'project'
  );
  assert.match(
    documentObject.getElementById('statusMessage').textContent,
    /Restored repository: project/
  );
  assert.equal(documentObject.getElementById('restoreFolderBtn').disabled, false);
  app.dispose();
});

test('bootShellUI falls back to manual restore when silent startup restore cannot re-grant access', async () => {
  const rootHandle = createDirectory('project', [
    createDirectory('src', [createFile('index.ts', 'export const value = 1;\n')])
  ]);
  const documentObject = createShellDocument();
  const windowObject = createWindowObject();
  const harness = createBootApp({
    rootHandle,
    persistedRepositoryHandle: rootHandle,
    denySilentRestore: true
  });

  const app = bootShellUI({
    bootApp: harness.bootApp,
    documentObject,
    windowObject,
    storage: {}
  });

  await flushAsyncWork();

  assert.equal(app.controller.getState().session.repositoryHandle, null);
  assert.deepEqual(harness.restoreCalls, [{ allowPrompt: false }]);
  assert.match(
    documentObject.getElementById('statusMessage').textContent,
    /Use Restore Last Folder to re-grant access/
  );

  documentObject.getElementById('restoreFolderBtn').click();
  await flushAsyncWork();

  assert.equal(app.controller.getState().repository.snapshot?.rootName, 'project');
  assert.deepEqual(harness.restoreCalls, [{ allowPrompt: false }, { allowPrompt: true }]);
  assert.match(
    documentObject.getElementById('statusMessage').textContent,
    /Restored repository: project/
  );
  app.dispose();
});

test('bootShellUI captures runtime diagnostics and supports copying and clearing them', async () => {
  const documentObject = createShellDocument();
  const windowObject = createWindowObject();
  const harness = createBootApp({
    rootHandle: createDirectory('project', [createFile('README.md', '# Title\n')])
  });

  const app = bootShellUI({
    bootApp: harness.bootApp,
    documentObject,
    windowObject,
    storage: {}
  });

  await flushAsyncWork();

  windowObject.dispatchEvent('error', {
    message: 'boom',
    filename: '/tmp/app.js',
    lineno: 12,
    colno: 4
  });
  windowObject.dispatchEvent('unhandledrejection', {
    reason: new Error('unhandled boom')
  });
  await flushAsyncWork();

  const diagnosticsText = documentObject.getElementById('diagnosticsLog').textContent;
  assert.match(diagnosticsText, /window-error/);
  assert.match(diagnosticsText, /unhandled-rejection/);

  documentObject.getElementById('copyDiagnosticsBtn').click();
  await flushAsyncWork();

  assert.equal(harness.outputHost.copiedTexts.length, 1);
  assert.match(harness.outputHost.copiedTexts[0], /window-error/);
  assert.match(
    documentObject.getElementById('statusMessage').textContent,
    /Diagnostics copied to clipboard/
  );

  documentObject.getElementById('clearDiagnosticsBtn').click();
  await flushAsyncWork();

  assert.equal(harness.diagnosticsHost.exportEntries().length, 0);
  assert.equal(documentObject.getElementById('diagnosticsLog').textContent, 'No diagnostics yet.');
  assert.match(
    documentObject.getElementById('statusMessage').textContent,
    /Diagnostics cleared/
  );

  app.dispose();
});

test('bootShellUI renders nested tree rows with depth-aware indentation metadata', async () => {
  const documentObject = createShellDocument();
  const windowObject = createWindowObject();
  const harness = createBootApp({
    rootHandle: createDirectory('project', [
      createDirectory('src', [
        createDirectory('components', [createFile('Button.tsx', 'export function Button() {}\n')]),
        createFile('index.ts', 'export const value = 1;\n')
      ]),
      createFile('README.md', '# Title\n')
    ])
  });

  const app = bootShellUI({
    bootApp: harness.bootApp,
    documentObject,
    windowObject,
    storage: {}
  });

  documentObject.getElementById('selectFolderBtn').click();
  await flushAsyncWork();

  const treeList = documentObject.getElementById('treeList');
  assert.deepEqual(
    treeList.children.map((row) => row.children.at(-1)?.textContent),
    ['📁 src (0/2)', '📄 README.md (0.01 KB)']
  );

  treeList.dispatchEvent('click', {
    target: treeList.children[0].children[0]
  });
  await flushAsyncWork();

  assert.deepEqual(
    treeList.children.map((row) => row.style.getPropertyValue('--depth')),
    ['0', '1', '1', '0']
  );
  assert.equal(treeList.children[1].children.at(-1)?.textContent, '📁 components (0/1)');
  assert.equal(treeList.children[2].children.at(-1)?.textContent, '📄 index.ts (0.02 KB)');

  app.dispose();
});

test('bootShellUI exposes an explicit select-all text-files action and updates it after bulk selection', async () => {
  const documentObject = createShellDocument();
  const windowObject = createWindowObject();
  const harness = createBootApp({
    rootHandle: createDirectory('project', [
      createDirectory('src', [
        createFile('index.ts', 'export const value = 1;\n'),
        createFile('util.ts', 'export const util = 2;\n')
      ]),
      createFile('README.md', '# Title\n')
    ])
  });

  const app = bootShellUI({
    bootApp: harness.bootApp,
    documentObject,
    windowObject,
    storage: {}
  });

  documentObject.getElementById('selectFolderBtn').click();
  await flushAsyncWork();

  assert.equal(
    documentObject.getElementById('toggleVisibleBtn').textContent,
    'Select All Text Files'
  );

  documentObject.getElementById('toggleVisibleBtn').click();
  await flushAsyncWork();

  assert.equal(
    documentObject.getElementById('toggleVisibleBtn').textContent,
    'Deselect All Text Files'
  );
  assert.equal(app.controller.getState().selection.selectedPaths.size, 3);

  app.dispose();
});
