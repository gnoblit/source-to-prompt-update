import test from 'node:test';
import assert from 'node:assert/strict';

import { createAppState } from '../../packages/application/src/state/create-app-state.js';
import {
  addRepositoryEntry,
  createRepositoryIndex
} from '../../packages/core/src/models/repository-index.js';
import {
  getCombineEligibility,
  selectFolderCheckboxState,
  selectSelectionTally,
  selectTreeRows,
  selectTreeView
} from '../../packages/application/src/selectors/index.js';

function createStateWithIndex() {
  const state = createAppState();
  const index = createRepositoryIndex();

  addRepositoryEntry(index, { path: 'src', kind: 'directory', depth: 0 });
  addRepositoryEntry(index, { path: 'src/components', kind: 'directory', depth: 1 });
  addRepositoryEntry(index, {
    path: 'src/components/Button.tsx',
    kind: 'file',
    depth: 2,
    isText: true,
    size: 120,
    lines: 10
  });
  addRepositoryEntry(index, {
    path: 'src/index.ts',
    kind: 'file',
    depth: 1,
    isText: true,
    size: 80,
    lines: null
  });
  addRepositoryEntry(index, {
    path: 'logo.png',
    kind: 'file',
    depth: 0,
    isText: false,
    size: 2048
  });

  state.repository.snapshot = {
    repositoryId: 'project',
    rootName: 'project',
    index
  };

  return state;
}

test('selectTreeRows returns stable directory-first tree order', () => {
  const state = createStateWithIndex();
  const rows = selectTreeRows(state);

  assert.deepEqual(
    rows.map((row) => row.path),
    ['src', 'src/components', 'src/components/Button.tsx', 'src/index.ts', 'logo.png']
  );
});

test('selectTreeView hides descendants of collapsed folders until expanded', () => {
  const state = createStateWithIndex();
  let treeView = selectTreeView(state);

  assert.deepEqual(treeView.visibleRows.map((row) => row.path), ['src', 'logo.png']);

  state.ui.expandedFolders.add('src');
  treeView = selectTreeView(state);
  assert.deepEqual(treeView.visibleRows.map((row) => row.path), [
    'src',
    'src/components',
    'src/index.ts',
    'logo.png'
  ]);

  state.ui.expandedFolders.add('src/components');
  treeView = selectTreeView(state);
  assert.deepEqual(treeView.visibleRows.map((row) => row.path), [
    'src',
    'src/components',
    'src/components/Button.tsx',
    'src/index.ts',
    'logo.png'
  ]);
});

test('selectTreeView shows ancestor chain when a filter query is active', () => {
  const state = createStateWithIndex();
  state.filter.query = 'button';

  const treeView = selectTreeView(state);
  assert.deepEqual(treeView.visibleRows.map((row) => row.path), [
    'src',
    'src/components',
    'src/components/Button.tsx'
  ]);
});

test('selectSelectionTally and folder checkbox state derive UI-friendly stats', () => {
  const state = createStateWithIndex();
  state.ui.expandedFolders.add('src');
  state.ui.expandedFolders.add('src/components');
  state.selection.selectedPaths.add('src/components/Button.tsx');

  const tally = selectSelectionTally(state);
  const srcState = selectFolderCheckboxState(state, 'src');
  const componentsState = selectFolderCheckboxState(state, 'src/components');

  assert.equal(tally.selectedTotalSize, 120);
  assert.equal(tally.selectedKnownLines, 10);
  assert.equal(tally.selectedUnknownLineFiles, 0);
  assert.equal(srcState.checked, false);
  assert.equal(srcState.indeterminate, true);
  assert.equal(componentsState.checked, true);
});

test('getCombineEligibility reflects whether any paths are selected', () => {
  const state = createStateWithIndex();
  assert.equal(getCombineEligibility(state), false);
  state.selection.selectedPaths.add('src/index.ts');
  assert.equal(getCombineEligibility(state), true);
});
