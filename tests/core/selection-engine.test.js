import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySelectionChange,
  computeFolderSelectionStats,
  createSelectionState,
  reconcileSelectedPaths
} from '../../packages/core/src/selection/selection-engine.js';

test('applies file selection changes and updates tallies', () => {
  const state = createSelectionState();
  const fileRecordsByPath = new Map([
    ['src/a.ts', { size: 100, lines: 10 }],
    ['src/b.ts', { size: 50, lines: null }]
  ]);
  const ancestorsByFilePath = new Map([
    ['src/a.ts', ['src']],
    ['src/b.ts', ['src']]
  ]);
  const filterVisibleFilePaths = new Set(['src/a.ts', 'src/b.ts']);

  const { changed, nextState, folderDeltaByPath } = applySelectionChange({
    state,
    paths: ['src/a.ts', 'src/b.ts'],
    shouldSelect: true,
    fileRecordsByPath,
    ancestorsByFilePath,
    filterVisibleFilePaths,
    options: { trackFilterSelections: true }
  });

  assert.equal(changed, true);
  assert.equal(nextState.selectedPaths.has('src/a.ts'), true);
  assert.equal(nextState.selectedPaths.has('src/b.ts'), true);
  assert.equal(nextState.selectedTotalSize, 150);
  assert.equal(nextState.selectedKnownLines, 10);
  assert.equal(nextState.selectedUnknownLineFiles, 1);
  assert.equal(folderDeltaByPath.get('src'), 2);
});

test('computes folder selection stats from selected and visible files', () => {
  const stats = computeFolderSelectionStats({
    folderPaths: ['src'],
    filePaths: ['src/a.ts', 'src/b.ts'],
    filterVisiblePaths: new Set(['src/a.ts', 'src/b.ts']),
    rowVisibilityByPath: new Map([
      ['src/a.ts', true],
      ['src/b.ts', false]
    ]),
    selectedPaths: new Set(['src/a.ts']),
    ancestorsByFilePath: new Map([
      ['src/a.ts', ['src']],
      ['src/b.ts', ['src']]
    ])
  });

  assert.equal(stats.visibleFilePaths.has('src/a.ts'), true);
  assert.equal(stats.visibleFilePaths.has('src/b.ts'), false);
  assert.equal(stats.folderVisibleFileCount.get('src'), 2);
  assert.equal(stats.folderSelectedVisibleFileCount.get('src'), 1);
});

test('reconciles selected paths against available paths', () => {
  const reconciled = reconcileSelectedPaths({
    selectedPaths: new Set(['src/a.ts', 'src/missing.ts']),
    availablePaths: new Set(['src/a.ts', 'src/b.ts'])
  });

  assert.deepEqual([...reconciled], ['src/a.ts']);
});
