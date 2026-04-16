import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

function compareSnapshots(left, right) {
  if (left.size !== right.size) {
    return false;
  }

  for (const [relativePath, entry] of left.entries()) {
    const matchingEntry = right.get(relativePath);
    if (!matchingEntry) {
      return false;
    }

    if (
      matchingEntry.sourcePath !== entry.sourcePath ||
      matchingEntry.mtimeMs !== entry.mtimeMs ||
      matchingEntry.size !== entry.size
    ) {
      return false;
    }
  }

  return true;
}

async function walkFiles(basePath, relativePrefix = '') {
  const directoryEntries = await readdir(basePath, { withFileTypes: true });
  directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

  const files = [];

  for (const entry of directoryEntries) {
    const relativePath = relativePrefix
      ? `${relativePrefix}/${entry.name}`
      : entry.name;
    const absolutePath = path.resolve(basePath, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walkFiles(absolutePath, relativePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const metadata = await stat(absolutePath);
    files.push({
      relativePath,
      sourcePath: absolutePath,
      mtimeMs: metadata.mtimeMs,
      size: metadata.size
    });
  }

  return files;
}

async function createSourceSnapshot(paths) {
  const snapshotEntries = [
    {
      relativePath: 'index.html',
      sourcePath: paths.indexSource,
      ...(await stat(paths.indexSource))
    },
    ...(await walkFiles(paths.srcSource, 'src')),
    ...(await walkFiles(paths.packagesSource, 'packages'))
  ];

  return new Map(
    snapshotEntries.map((entry) => [
      entry.relativePath,
      {
        sourcePath: entry.sourcePath,
        mtimeMs: entry.mtimeMs,
        size: entry.size
      }
    ])
  );
}

async function reconcileSnapshot(paths, previousSnapshot = new Map()) {
  const nextSnapshot = await createSourceSnapshot(paths);

  if (compareSnapshots(previousSnapshot, nextSnapshot)) {
    return nextSnapshot;
  }

  await mkdir(paths.distRoot, { recursive: true });

  for (const [relativePath, entry] of nextSnapshot.entries()) {
    const previousEntry = previousSnapshot.get(relativePath);

    if (
      previousEntry &&
      previousEntry.sourcePath === entry.sourcePath &&
      previousEntry.mtimeMs === entry.mtimeMs &&
      previousEntry.size === entry.size
    ) {
      continue;
    }

    const destinationPath = path.resolve(paths.distRoot, relativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(entry.sourcePath, destinationPath);
  }

  for (const relativePath of previousSnapshot.keys()) {
    if (nextSnapshot.has(relativePath)) {
      continue;
    }

    await rm(path.resolve(paths.distRoot, relativePath), {
      recursive: true,
      force: true
    });
  }

  return nextSnapshot;
}

export function getTauriFrontendPaths(repositoryRoot) {
  const appRoot = path.resolve(repositoryRoot, 'apps/tauri');

  return {
    appRoot,
    distRoot: path.resolve(appRoot, '.frontend-dist'),
    indexSource: path.resolve(appRoot, 'index.html'),
    srcSource: path.resolve(appRoot, 'src'),
    packagesSource: path.resolve(repositoryRoot, 'packages')
  };
}

export async function syncTauriFrontendDist(repositoryRoot) {
  if (!repositoryRoot) {
    throw new TypeError('syncTauriFrontendDist requires a repository root');
  }

  const paths = getTauriFrontendPaths(repositoryRoot);

  await rm(paths.distRoot, { recursive: true, force: true });
  await mkdir(paths.distRoot, { recursive: true });

  const snapshot = await reconcileSnapshot(paths);

  return {
    ...paths,
    snapshot
  };
}

export async function startTauriFrontendDistWatcher(repositoryRoot, options = {}) {
  if (!repositoryRoot) {
    throw new TypeError('startTauriFrontendDistWatcher requires a repository root');
  }

  const intervalMs = Math.max(100, Number(options.intervalMs) || 400);
  const onError =
    typeof options.onError === 'function'
      ? options.onError
      : (error) => {
          console.error(`Failed to refresh the staged Tauri frontend: ${error.message}`);
        };

  const paths = getTauriFrontendPaths(repositoryRoot);
  let snapshot = options.initialSnapshot instanceof Map ? options.initialSnapshot : new Map();
  let currentSync = null;
  let pendingSync = false;
  let stopped = false;

  async function performSync() {
    if (stopped) {
      return snapshot;
    }

    if (currentSync) {
      pendingSync = true;
      return currentSync;
    }

    currentSync = (async () => {
      do {
        pendingSync = false;
        try {
          snapshot = await reconcileSnapshot(paths, snapshot);
        } catch (error) {
          onError(error);
        }
      } while (pendingSync && !stopped);

      return snapshot;
    })().finally(() => {
      currentSync = null;
    });

    return currentSync;
  }

  const intervalId = setInterval(() => {
    void performSync();
  }, intervalMs);

  if (typeof intervalId.unref === 'function') {
    intervalId.unref();
  }

  return {
    async syncNow() {
      return performSync();
    },
    async stop() {
      stopped = true;
      clearInterval(intervalId);
      if (currentSync) {
        await currentSync;
      }
    }
  };
}
