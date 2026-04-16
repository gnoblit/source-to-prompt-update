import test from 'node:test';
import assert from 'node:assert/strict';

import { isLikelyTextFile } from '../../packages/core/src/file-types/text-file-rules.js';

test('detects common text files and configuration dotfiles', () => {
  assert.equal(isLikelyTextFile('index.tsx'), true);
  assert.equal(isLikelyTextFile('.env.local'), true);
  assert.equal(isLikelyTextFile('.prettierrc'), true);
  assert.equal(isLikelyTextFile('.eslintrc.js'), true);
  assert.equal(isLikelyTextFile('Dockerfile'), true);
  assert.equal(isLikelyTextFile('nested/path/Makefile'), true);
});

test('rejects obvious binary-like assets', () => {
  assert.equal(isLikelyTextFile('photo.png'), false);
  assert.equal(isLikelyTextFile('archive.zip'), false);
  assert.equal(isLikelyTextFile('font.woff2'), false);
  assert.equal(isLikelyTextFile(''), false);
});
