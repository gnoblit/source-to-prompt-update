import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';

import { acquireElectronCliLock } from '../../scripts/lib/electron-cli-lock.mjs';

async function createTempRepository() {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'ysp-electron-lock-'));
  await mkdir(path.resolve(repositoryRoot, 'apps/electron'), { recursive: true });
  return repositoryRoot;
}

test('acquireElectronCliLock blocks a second live Electron owner', async () => {
  const repositoryRoot = await createTempRepository();

  try {
    const primaryLock = await acquireElectronCliLock(repositoryRoot, {
      pid: 111,
      args: ['.'],
      processAlive(pid) {
        return pid === 111;
      }
    });

    assert.equal(primaryLock.acquired, true);

    const competingLock = await acquireElectronCliLock(repositoryRoot, {
      pid: 222,
      args: ['.'],
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

test('acquireElectronCliLock recovers from stale lock files', async () => {
  const repositoryRoot = await createTempRepository();

  try {
    const staleLock = await acquireElectronCliLock(repositoryRoot, {
      pid: 333,
      args: ['.'],
      processAlive() {
        return false;
      }
    });

    assert.equal(staleLock.acquired, true);

    const recoveredLock = await acquireElectronCliLock(repositoryRoot, {
      pid: 444,
      args: ['.'],
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
