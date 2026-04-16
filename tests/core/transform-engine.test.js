import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySafeMinify,
  buildTransformPlan,
  buildTransformResult,
  removeCommentsHeuristic
} from '../../packages/core/src/transforms/transform-engine.js';

test('buildTransformPlan classifies unsafe comment removal explicitly', () => {
  const plan = buildTransformPlan({
    selectedFiles: [{ path: 'src/index.ts', content: 'const value = 1;' }],
    options: { removeComments: true, minifyOutput: false }
  });

  assert.equal(plan.safetyClass, 'unsafe');
  assert.equal(plan.transforms.length, 1);
  assert.equal(plan.transforms[0].kind, 'remove-comments');
  assert.equal(plan.warnings.length > 0, true);
});

test('removeCommentsHeuristic strips obvious comments from supported languages', () => {
  const js = removeCommentsHeuristic(
    'src/index.ts',
    'const value = 1; // trailing comment\n/* block */\nconst next = 2;'
  );
  const py = removeCommentsHeuristic('tool.py', '# header\nvalue = 1');

  assert.equal(js.includes('trailing comment'), false);
  assert.equal(js.includes('block'), false);
  assert.equal(py.includes('# header'), false);
});

test('applySafeMinify conservatively compacts json and trims trailing whitespace elsewhere', () => {
  const json = applySafeMinify('data.json', '{\n  "value": 1\n}\n');
  const ts = applySafeMinify('src/index.ts', 'const value = 1;   \n');

  assert.equal(json.content, '{"value":1}');
  assert.equal(ts.content, 'const value = 1;\n');
});

test('buildTransformResult returns provenance, warnings, and aggregate stats', async () => {
  const result = await buildTransformResult({
    selectedFiles: [
      {
        path: 'src/index.ts',
        content: 'const value = 1; // comment\n',
        size: 28,
        lines: 1
      },
      {
        path: 'data.json',
        content: '{\n  "value": 1\n}\n',
        size: 18,
        lines: 3
      }
    ],
    options: {
      removeComments: true,
      minifyOutput: true
    }
  });

  assert.equal(result.plan.transforms.length, 2);
  assert.equal(result.transformedFiles.length, 2);
  assert.equal(result.transformProvenance.length, 2);
  assert.equal(result.stats.originalTotalSize >= result.stats.afterMinifyTotalSize, true);
  assert.equal(result.warnings.length >= 1, true);
  assert.match(result.transformedFiles[1].content, /^\{"value":1\}$/);
});
