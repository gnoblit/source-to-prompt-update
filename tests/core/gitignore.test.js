import test from 'node:test';
import assert from 'node:assert/strict';

import { GitIgnoreMatcher } from '../../packages/core/src/ignore/gitignore.js';

test('applies built-in default ignore patterns', () => {
  const matcher = new GitIgnoreMatcher('');

  assert.equal(matcher.ignores('node_modules/pkg/index.js'), true);
  assert.equal(matcher.ignores('.git/config'), true);
  assert.equal(matcher.ignores('coverage/index.html'), true);
  assert.equal(matcher.ignores('.venv/bin/python'), true);
  assert.equal(matcher.ignores('package-lock.json'), true);
  assert.equal(matcher.ignores('nested/yarn.lock'), true);
  assert.equal(matcher.ignores('apps/electron/.electron-cli.lock'), true);
  assert.equal(matcher.ignores('src/index.ts'), false);
});

test('supports negation patterns and root-relative patterns', () => {
  const matcher = new GitIgnoreMatcher(`
dist/
!dist/keep.txt
/root-only.js
`);

  assert.equal(matcher.ignores('dist/app.js'), true);
  assert.equal(matcher.ignores('dist/keep.txt'), false);
  assert.equal(matcher.ignores('root-only.js'), true);
  assert.equal(matcher.ignores('nested/root-only.js'), false);
});

test('allows repo patterns to opt built-in ignored files back in', () => {
  const matcher = new GitIgnoreMatcher(`
!package-lock.json
!.venv/pyvenv.cfg
`);

  assert.equal(matcher.ignores('package-lock.json'), false);
  assert.equal(matcher.ignores('.venv/pyvenv.cfg'), false);
  assert.equal(matcher.ignores('.venv/bin/python'), true);
});

test('normalizes windows-style paths for matching', () => {
  const matcher = new GitIgnoreMatcher('build/');

  assert.equal(matcher.ignores('\\build\\index.js'), true);
  assert.equal(matcher.ignores('src\\index.js'), false);
});

test('debugMatches reports all matching patterns in order', () => {
  const matcher = new GitIgnoreMatcher('dist/\n!dist/keep.txt');
  const matches = matcher.debugMatches('dist/keep.txt');

  assert.equal(matches.length >= 2, true);
  assert.equal(matches.at(-1).isNegation, true);
});
