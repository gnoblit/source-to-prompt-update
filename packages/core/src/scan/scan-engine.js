import { isLikelyTextFile } from '../file-types/text-file-rules.js';
import { GitIgnoreMatcher } from '../ignore/gitignore.js';
import { createRepositorySnapshot } from '../models/repository-snapshot.js';
import {
  addRepositoryEntry,
  createRepositoryIndex
} from '../models/repository-index.js';

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    const error = new Error('Scan aborted');
    error.name = 'AbortError';
    throw error;
  }
}

function createProgressPayload(payload) {
  return {
    phase: payload.phase || 'scan',
    currentPath: payload.currentPath || '',
    discoveredEntries: payload.discoveredEntries || 0,
    processedEntries: payload.processedEntries || 0
  };
}

async function emitProgress(onProgress, payload) {
  if (typeof onProgress === 'function') {
    await onProgress(createProgressPayload(payload));
  }
}

async function loadIgnoreMatcher({ rootHandle, host, signal }) {
  const entries = await host.listDirectory(rootHandle, { signal });
  const gitignoreEntry = entries.find(
    (entry) => entry && entry.kind === 'file' && entry.name === '.gitignore'
  );

  if (!gitignoreEntry) {
    return {
      matcher: new GitIgnoreMatcher(''),
      ignoreSource: 'default'
    };
  }

  try {
    const content = await host.readTextFile(gitignoreEntry.handle, { signal });
    return {
      matcher: new GitIgnoreMatcher(content || ''),
      ignoreSource: content && content.trim() ? 'gitignore' : 'default'
    };
  } catch {
    return {
      matcher: new GitIgnoreMatcher(''),
      ignoreSource: 'default'
    };
  }
}

async function scanDirectory({
  host,
  handle,
  path = '',
  depth = 0,
  index,
  matcher,
  signal,
  counters,
  onProgress
}) {
  let entries;
  try {
    entries = await host.listDirectory(handle, { signal });
  } catch (error) {
    counters.unreadableEntries += 1;
    counters.errors.push({
      type: 'scan-enumerate-failed',
      path: path || '.',
      error
    });
    return;
  }

  entries.sort((left, right) => {
    if (left.kind === right.kind) {
      return left.name.localeCompare(right.name);
    }
    return left.kind === 'directory' ? -1 : 1;
  });

  counters.discoveredEntries += entries.length;
  await emitProgress(onProgress, {
    phase: 'enumerate',
    currentPath: path || '.',
    discoveredEntries: counters.discoveredEntries,
    processedEntries: counters.processedEntries
  });

  for (let indexPosition = 0; indexPosition < entries.length; indexPosition += 1) {
    throwIfAborted(signal);

    const entry = entries[indexPosition];
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    if (matcher.ignores(entryPath)) {
      continue;
    }

    if (entry.kind === 'directory') {
      addRepositoryEntry(index, {
        path: entryPath,
        name: entry.name,
        kind: 'directory',
        depth
      });
      counters.directoryCount += 1;
      counters.processedEntries += 1;
      await emitProgress(onProgress, {
        phase: 'scan-directory',
        currentPath: entryPath,
        discoveredEntries: counters.discoveredEntries,
        processedEntries: counters.processedEntries
      });

      await scanDirectory({
        host,
        handle: entry.handle,
        path: entryPath,
        depth: depth + 1,
        index,
        matcher,
        signal,
        counters,
        onProgress
      });
      continue;
    }

    let isText = isLikelyTextFile(entry.name);
    let size = 0;

    if (isText) {
      try {
        const metadata = await host.readFileMetadata(entry.handle, { signal });
        size = typeof metadata?.size === 'number' ? metadata.size : 0;
      } catch (error) {
        counters.unreadableEntries += 1;
        counters.errors.push({
          type: 'scan-file-read-failed',
          path: entryPath,
          error
        });
        isText = false;
        size = 0;
      }
    }

    addRepositoryEntry(index, {
      path: entryPath,
      name: entry.name,
      kind: 'file',
      depth,
      isText,
      size,
      lines: null
    });

    counters.fileCount += 1;
    if (isText) {
      counters.textFileCount += 1;
    }
    counters.processedEntries += 1;

    await emitProgress(onProgress, {
      phase: 'scan-file',
      currentPath: entryPath,
      discoveredEntries: counters.discoveredEntries,
      processedEntries: counters.processedEntries
    });
  }
}

export async function scanRepository({
  rootHandle,
  host,
  signal,
  onProgress
} = {}) {
  if (!rootHandle) {
    throw new TypeError('scanRepository requires a rootHandle');
  }
  if (!host || typeof host.listDirectory !== 'function') {
    throw new TypeError('scanRepository requires a host with listDirectory support');
  }

  throwIfAborted(signal);

  const { matcher, ignoreSource } = await loadIgnoreMatcher({ rootHandle, host, signal });
  const index = createRepositoryIndex();
  const counters = {
    discoveredEntries: 0,
    processedEntries: 0,
    directoryCount: 0,
    fileCount: 0,
    textFileCount: 0,
    unreadableEntries: 0,
    errors: []
  };

  await emitProgress(onProgress, {
    phase: 'start',
    currentPath: rootHandle.name || '.',
    discoveredEntries: 0,
    processedEntries: 0
  });

  await scanDirectory({
    host,
    handle: rootHandle,
    path: '',
    depth: 0,
    index,
    matcher,
    signal,
    counters,
    onProgress
  });

  const snapshot = createRepositorySnapshot({
    repositoryId: rootHandle.id || rootHandle.name || null,
    rootName: rootHandle.name || '',
    scannedAt: new Date().toISOString(),
    capabilities: {
      repositoryAccess: true
    },
    limitations: [],
    index,
    diagnosticsSummary: {
      unreadableEntries: counters.unreadableEntries,
      errors: counters.errors.map((entry) => ({
        type: entry.type,
        path: entry.path,
        errorName: entry.error?.name || 'Error',
        errorMessage: entry.error?.message || ''
      }))
    },
    stats: {
      directoryCount: counters.directoryCount,
      fileCount: counters.fileCount,
      textFileCount: counters.textFileCount
    }
  });

  await emitProgress(onProgress, {
    phase: 'complete',
    currentPath: rootHandle.name || '.',
    discoveredEntries: counters.discoveredEntries,
    processedEntries: counters.processedEntries
  });

  return {
    snapshot,
    index,
    ignoreSource,
    stats: snapshot.stats,
    diagnosticsSummary: snapshot.diagnosticsSummary
  };
}
