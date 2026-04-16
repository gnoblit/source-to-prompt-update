import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeError } from '../../packages/core/src/errors/normalize-error.js';

test('normalizes protected-folder abort errors as cancelled', () => {
  const result = normalizeError(
    { name: 'AbortError', message: 'Access to protected system folder was not allowed' },
    'Select folder'
  );

  assert.equal(result.cancelled, true);
  assert.equal(result.name, 'AbortError');
  assert.match(result.userMessage, /protected/i);
  assert.match(result.userMessage, /Select folder/);
});

test('normalizes permission and security errors with actionable messaging', () => {
  const permission = normalizeError(
    { name: 'NotAllowedError', message: 'Permission denied' },
    'Save output'
  );
  const security = normalizeError(
    { name: 'SecurityError', message: 'Blocked by policy' },
    'Restore repository'
  );

  assert.equal(permission.cancelled, false);
  assert.match(permission.userMessage, /permissions/i);
  assert.match(security.userMessage, /security policy/i);
});

test('normalizes host-specific folder picker type errors', () => {
  const result = normalizeError(
    { name: 'TypeError', message: 'window.showDirectoryPicker is not a function' },
    'Select folder'
  );

  assert.equal(result.cancelled, false);
  assert.match(result.userMessage, /Folder selection is unavailable/);
});

test('falls back to a generic error envelope', () => {
  const result = normalizeError('something went wrong', 'Combine files');

  assert.equal(result.cancelled, false);
  assert.equal(result.technical, 'Error: something went wrong');
  assert.match(result.userMessage, /Combine files failed/);
});
