import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addRepositoryEntry,
  createRepositoryIndex,
  getAncestorPaths,
  listTextFilePaths
} from '../../packages/core/src/models/repository-index.js';

test('computes ancestor paths for nested entries', () => {
  assert.deepEqual(getAncestorPaths('src/components/Button.tsx'), [
    'src',
    'src/components'
  ]);
  assert.deepEqual(getAncestorPaths('README.md'), []);
});

test('tracks entries, directory children, and text files', () => {
  const index = createRepositoryIndex();

  addRepositoryEntry(index, { path: 'src', kind: 'directory', depth: 0 });
  addRepositoryEntry(index, { path: 'src/components', kind: 'directory', depth: 1 });
  addRepositoryEntry(index, {
    path: 'src/components/Button.tsx',
    kind: 'file',
    depth: 2,
    isText: true,
    size: 128
  });
  addRepositoryEntry(index, {
    path: 'src/logo.png',
    kind: 'file',
    depth: 1,
    isText: false,
    size: 512
  });

  assert.equal(index.entriesByPath.get('src/components/Button.tsx').size, 128);
  assert.equal(index.childPathsByDirectory.get('src').has('src/components/Button.tsx'), true);
  assert.equal(index.childPathsByDirectory.get('src').has('src/logo.png'), true);
  assert.deepEqual(listTextFilePaths(index), ['src/components/Button.tsx']);
});
