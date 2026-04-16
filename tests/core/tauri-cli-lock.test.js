import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';

import { acquireTauriCliLock } from '../../scripts/lib/tauri-cli-lock.mjs';

async function createTempRepository() {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'ysp-tauri-lock-'));
  await mkdir(path.resolve(repositoryRoot, 'apps/tauri'), { recursive: true });
  return repositoryRoot;
}

test('acquireTauriCliLock blocks a second live Tauri CLI owner from reusing the staged frontend', async () => {
  const repositoryRoot = await createTempRepository();

  try {
    const primaryLock = await acquireTauriCliLock(repositoryRoot, {
      pid: 111,
      args: ['dev'],
      processAlive(pid) {
        return pid === 111;
      }
    });

    assert.equal(primaryLock.acquired, true);

    const competingLock = await acquireTauriCliLock(repositoryRoot, {
      pid: 222,
      args: ['build'],
      processAlive(pid) {
        return pid === 111;
      }
    });

    assert.equal(competingLock.acquired, false);
    assert.equal(competingLock.existingLock.pid, 111);

    await primaryLock.release();
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test('acquireTauriCliLock recovers from stale lock files', async () => {
  const repositoryRoot = await createTempRepository();

  try {
    const staleLock = await acquireTauriCliLock(repositoryRoot, {
      pid: 333,
      args: ['dev'],
      processAlive() {
        return false;
      }
    });

    assert.equal(staleLock.acquired, true);

    const recoveredLock = await acquireTauriCliLock(repositoryRoot, {
      pid: 444,
      args: ['dev'],
      processAlive(pid) {
        return pid === 444;
      }
    });

    assert.equal(recoveredLock.acquired, true);
    assert.equal(recoveredLock.lock.pid, 444);

    await recoveredLock.release();
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});
