import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';

import {
  startTauriFrontendDistWatcher,
  syncTauriFrontendDist
} from '../../scripts/lib/tauri-frontend-dist.mjs';

async function createTempRepository() {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'ysp-tauri-dist-'));

  await mkdir(path.resolve(repositoryRoot, 'apps/tauri/src'), { recursive: true });
  await mkdir(path.resolve(repositoryRoot, 'packages/core/src'), { recursive: true });

  await writeFile(
    path.resolve(repositoryRoot, 'apps/tauri/index.html'),
    '<!doctype html><html><body>Hello</body></html>\n'
  );
  await writeFile(
    path.resolve(repositoryRoot, 'apps/tauri/src/entry.js'),
    'export const entry = "initial";\n'
  );
  await writeFile(
    path.resolve(repositoryRoot, 'packages/core/src/value.js'),
    'export const value = 1;\n'
  );

  return repositoryRoot;
}

async function waitFor(condition, { timeoutMs = 2000, intervalMs = 40 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}

test('syncTauriFrontendDist stages the desktop frontend into a self-contained dist root', async () => {
  const repositoryRoot = await createTempRepository();

  try {
    const result = await syncTauriFrontendDist(repositoryRoot);

    assert.equal(
      await readFile(path.resolve(result.distRoot, 'index.html'), 'utf8'),
      '<!doctype html><html><body>Hello</body></html>\n'
    );
    assert.equal(
      await readFile(path.resolve(result.distRoot, 'src/entry.js'), 'utf8'),
      'export const entry = "initial";\n'
    );
    assert.equal(
      await readFile(path.resolve(result.distRoot, 'packages/core/src/value.js'), 'utf8'),
      'export const value = 1;\n'
    );
    assert.equal(result.snapshot.has('src/entry.js'), true);
    assert.equal(result.snapshot.has('packages/core/src/value.js'), true);
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test('startTauriFrontendDistWatcher mirrors updates and deletions while tauri dev is running', async () => {
  const repositoryRoot = await createTempRepository();
  let watcher = null;

  try {
    const syncResult = await syncTauriFrontendDist(repositoryRoot);
    watcher = await startTauriFrontendDistWatcher(repositoryRoot, {
      initialSnapshot: syncResult.snapshot,
      intervalMs: 100
    });

    await writeFile(
      path.resolve(repositoryRoot, 'apps/tauri/src/entry.js'),
      'export const entry = "updated";\n'
    );
    await rm(path.resolve(repositoryRoot, 'packages/core/src/value.js'));
    await writeFile(
      path.resolve(repositoryRoot, 'packages/core/src/new-value.js'),
      'export const nextValue = 2;\n'
    );

    await waitFor(async () => {
      const distEntry = await readFile(
        path.resolve(repositoryRoot, 'apps/tauri/.frontend-dist/src/entry.js'),
        'utf8'
      );

      return distEntry.includes('"updated"');
    });

    await waitFor(async () => {
      try {
        await access(path.resolve(repositoryRoot, 'apps/tauri/.frontend-dist/packages/core/src/value.js'));
        return false;
      } catch (error) {
        return error?.code === 'ENOENT';
      }
    });

    await waitFor(async () => {
      const distEntry = await readFile(
        path.resolve(repositoryRoot, 'apps/tauri/.frontend-dist/packages/core/src/new-value.js'),
        'utf8'
      );

      return distEntry.includes('nextValue');
    });
  } finally {
    if (watcher) {
      await watcher.stop();
    }

    await rm(repositoryRoot, { recursive: true, force: true });
  }
});
