import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPathFilter,
  computeRenderedRows
} from '../../packages/core/src/selection/filter-engine.js';

test('filter includes matching paths and their ancestors', () => {
  const allPaths = [
    'src',
    'src/components',
    'src/components/Button.tsx',
    'src/components/Card.tsx',
    'README.md'
  ];

  const result = applyPathFilter({ allPaths, query: 'button' });

  assert.equal(result.filterQueryActive, true);
  assert.deepEqual(
    [...result.filterVisiblePaths].sort(),
    ['src', 'src/components', 'src/components/Button.tsx']
  );
});

test('rendered rows respect collapsed folders only when no filter query is active', () => {
  const rows = [
    { path: 'src' },
    { path: 'src/components' },
    { path: 'src/components/Button.tsx' }
  ];
  const ancestorsByPath = new Map([
    ['src', []],
    ['src/components', ['src']],
    ['src/components/Button.tsx', ['src', 'src/components']]
  ]);

  const noFilter = computeRenderedRows({
    rows,
    filterVisiblePaths: new Set(rows.map((row) => row.path)),
    ancestorsByPath,
    collapsedFolders: new Set(['src']),
    filterQueryActive: false
  });

  assert.deepEqual(
    noFilter.visibleRows.map((row) => row.path),
    ['src']
  );

  const withFilter = computeRenderedRows({
    rows,
    filterVisiblePaths: new Set(rows.map((row) => row.path)),
    ancestorsByPath,
    collapsedFolders: new Set(['src']),
    filterQueryActive: true
  });

  assert.deepEqual(
    withFilter.visibleRows.map((row) => row.path),
    ['src', 'src/components', 'src/components/Button.tsx']
  );
});
