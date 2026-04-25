import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOutputPresentation,
  measureTextBytes
} from '../../packages/core/src/output/output-presentation.js';

test('measureTextBytes counts UTF-8 bytes without changing Unicode semantics', () => {
  assert.equal(measureTextBytes('abc'), 3);
  assert.equal(measureTextBytes('é'), 2);
  assert.equal(measureTextBytes('漢'), 3);
  assert.equal(measureTextBytes('😀'), 4);
});

test('buildOutputPresentation summarizes large text without expanding the preview', () => {
  const text = ['one', 'two', 'three'].join('\n');
  const presentation = buildOutputPresentation(text, {
    previewCharacterLimit: 8,
    copyByteLimit: 1024
  });

  assert.equal(presentation.stats.lines, 3);
  assert.equal(presentation.previewTruncated, true);
  assert.match(presentation.previewText, /Preview truncated/);
});
