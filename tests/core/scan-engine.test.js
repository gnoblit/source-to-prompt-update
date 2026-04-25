import test from 'node:test';
import assert from 'node:assert/strict';

import { scanRepository } from '../../packages/core/src/scan/scan-engine.js';
import { listTextFilePaths } from '../../packages/core/src/models/repository-index.js';

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
    size: options.size ?? content.length,
    unreadable: options.unreadable === true
  };
}

function createFakeRepositoryHost() {
  return {
    async listDirectory(handle) {
      if (handle.kind !== 'directory') {
        throw new TypeError('Can only list directory handles');
      }

      return handle.entries.map((entry) => ({
        name: entry.name,
        kind: entry.kind,
        handle: entry
      }));
    },

    async readTextFile(handle) {
      if (handle.kind !== 'file') {
        throw new TypeError('Can only read file handles');
      }
      if (handle.unreadable) {
        const error = new Error('Unreadable file');
        error.name = 'NotAllowedError';
        throw error;
      }
      return handle.content;
    },

    async readFileMetadata(handle) {
      if (handle.kind !== 'file') {
        throw new TypeError('Can only read file metadata from files');
      }
      if (handle.unreadable) {
        const error = new Error('Unreadable file');
        error.name = 'NotAllowedError';
        throw error;
      }
      return { size: handle.size };
    }
  };
}

test('scans a repository into an index with default ignores and text detection', async () => {
  const root = createDirectory('project', [
    createDirectory('src', [
      createFile('index.ts', 'export const value = 1;\n'),
      createFile('logo.png', 'binary', { size: 2048 })
    ]),
    createDirectory('.venv', [
      createFile('pyvenv.cfg', 'home = /usr/bin/python3\n')
    ]),
    createDirectory('node_modules', [
      createFile('ignored.js', 'console.log("ignored");')
    ]),
    createFile('.gitignore', 'dist/\n'),
    createDirectory('dist', [
      createFile('bundle.js', 'console.log("bundle");')
    ]),
    createFile('package-lock.json', '{\n  "lockfileVersion": 3\n}\n'),
    createFile('README.md', '# Title\n')
  ]);

  const progressPhases = [];
  const result = await scanRepository({
    rootHandle: root,
    host: createFakeRepositoryHost(),
    onProgress(payload) {
      progressPhases.push(payload.phase);
    }
  });

  assert.equal(result.snapshot.rootName, 'project');
  assert.equal(result.ignoreSource, 'gitignore');
  assert.deepEqual(listTextFilePaths(result.index), ['.gitignore', 'README.md', 'src/index.ts']);
  assert.equal(result.index.entriesByPath.has('.venv/pyvenv.cfg'), false);
  assert.equal(result.index.entriesByPath.has('node_modules/ignored.js'), false);
  assert.equal(result.index.entriesByPath.has('dist/bundle.js'), false);
  assert.equal(result.index.entriesByPath.has('package-lock.json'), false);
  assert.equal(result.index.entriesByPath.has('src/logo.png'), true);
  assert.equal(progressPhases.at(0), 'start');
  assert.equal(progressPhases.at(-1), 'complete');
});

test('tracks unreadable text files without crashing the scan', async () => {
  const root = createDirectory('project', [
    createFile('safe.ts', 'export const safeValue = true;'),
    createFile('secret.ts', 'export const hidden = true;', { unreadable: true })
  ]);

  const result = await scanRepository({
    rootHandle: root,
    host: createFakeRepositoryHost()
  });

  assert.equal(result.diagnosticsSummary.unreadableEntries, 1);
  assert.equal(result.index.entriesByPath.has('secret.ts'), true);
  assert.equal(result.index.textFilesByPath.has('secret.ts'), false);
  assert.deepEqual(listTextFilePaths(result.index), ['safe.ts']);
});

test('applies app-level ignore patterns alongside repository ignores', async () => {
  const root = createDirectory('project', [
    createDirectory('fixtures', [
      createFile('large.ts', 'export const fixture = true;\n')
    ]),
    createFile('safe.ts', 'export const safeValue = true;')
  ]);

  const result = await scanRepository({
    rootHandle: root,
    host: createFakeRepositoryHost(),
    additionalIgnorePatterns: 'fixtures/**'
  });

  assert.equal(result.ignoreSource, 'default+custom');
  assert.deepEqual(listTextFilePaths(result.index), ['safe.ts']);
});
