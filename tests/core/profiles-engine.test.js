import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyProfileToState,
  createProfileSnapshot,
  findProfileById,
  removeProfile,
  upsertProfile
} from '../../packages/core/src/profiles/profiles-engine.js';
import {
  addRepositoryEntry,
  createRepositoryIndex
} from '../../packages/core/src/models/repository-index.js';

test('createProfileSnapshot captures selected paths, options, and repository restore hints', () => {
  const snapshot = createProfileSnapshot({
    name: 'Frontend Focus',
    state: {
      selection: {
        selectedPaths: new Set(['src/index.ts', 'README.md'])
      },
      options: {
        includePreamble: true,
        preambleMode: 'custom',
        customPreamble: 'Review this project carefully.',
        includeGoal: true,
        goalText: 'Find the rendering bug.',
        transforms: {
          removeComments: true,
          minifyOutput: false
        }
      },
      output: {
        fileName: 'frontend_bundle.txt'
      }
    },
    repositorySnapshot: {
      repositoryId: 'repo-123',
      rootName: 'project'
    }
  });

  assert.equal(snapshot.name, 'Frontend Focus');
  assert.deepEqual(snapshot.selectedPaths, ['README.md', 'src/index.ts']);
  assert.equal(snapshot.promptOptions.includePreamble, true);
  assert.equal(snapshot.promptOptions.goalText, 'Find the rendering bug.');
  assert.equal(snapshot.transformOptions.removeComments, true);
  assert.equal(snapshot.outputOptions.fileName, 'frontend_bundle.txt');
  assert.deepEqual(snapshot.restoreHints, {
    repositoryId: 'repo-123',
    rootName: 'project'
  });
  assert.ok(snapshot.createdAt);
  assert.ok(snapshot.updatedAt);
});

test('upsertProfile updates existing profiles and removeProfile deletes them cleanly', () => {
  const created = {
    id: 'frontend-focus',
    name: 'Frontend Focus',
    selectedPaths: ['src/index.ts'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  const firstInsert = upsertProfile([], created);
  assert.equal(firstInsert.length, 1);

  const updated = upsertProfile(firstInsert, {
    ...created,
    name: 'Frontend Focus',
    selectedPaths: ['src/index.ts', 'src/app.ts']
  });

  const stored = findProfileById(updated, 'frontend-focus');
  assert.deepEqual(stored.selectedPaths, ['src/index.ts', 'src/app.ts']);
  assert.equal(stored.createdAt, '2024-01-01T00:00:00.000Z');
  assert.ok(stored.updatedAt);

  const removed = removeProfile(updated, 'frontend-focus');
  assert.equal(removed.length, 0);
});

test('applyProfileToState restores only available paths and reports missing entries', () => {
  const index = createRepositoryIndex();
  addRepositoryEntry(index, { path: 'src', kind: 'directory', depth: 0 });
  addRepositoryEntry(index, {
    path: 'src/index.ts',
    kind: 'file',
    depth: 1,
    isText: true,
    size: 10
  });
  addRepositoryEntry(index, {
    path: 'README.md',
    kind: 'file',
    depth: 0,
    isText: true,
    size: 12
  });

  const applied = applyProfileToState({
    profile: {
      id: 'frontend-focus',
      name: 'Frontend Focus',
      selectedPaths: ['README.md', 'src/index.ts', 'src/missing.ts'],
      promptOptions: {
        includePreamble: true,
        preambleMode: 'custom',
        customPreamble: 'Review carefully.',
        includeGoal: true,
        goalText: 'Explain the code.'
      },
      transformOptions: {
        removeComments: true,
        minifyOutput: true
      },
      outputOptions: {
        fileName: 'focused_output.txt'
      }
    },
    state: {
      selection: {
        selectedPaths: new Set(),
        filterSelectedPaths: new Set(['README.md'])
      },
      options: {
        includePreamble: false,
        preambleMode: 'custom',
        customPreamble: '',
        includeGoal: false,
        goalText: '',
        transforms: {
          removeComments: false,
          minifyOutput: false
        }
      },
      output: {
        fileName: 'combined_files.txt'
      },
      profile: {
        activeProfileId: null,
        savedProfiles: []
      }
    },
    repositoryIndex: index
  });

  assert.deepEqual([...applied.nextState.selection.selectedPaths].sort(), [
    'README.md',
    'src/index.ts'
  ]);
  assert.deepEqual(applied.missingPaths, ['src/missing.ts']);
  assert.equal(applied.nextState.options.includePreamble, true);
  assert.equal(applied.nextState.options.goalText, 'Explain the code.');
  assert.equal(applied.nextState.options.transforms.minifyOutput, true);
  assert.equal(applied.nextState.output.fileName, 'focused_output.txt');
  assert.equal(applied.nextState.profile.activeProfileId, 'frontend-focus');
  assert.deepEqual([...applied.nextState.selection.filterSelectedPaths], []);
});
