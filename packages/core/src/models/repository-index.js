function cloneMapOfSets(value) {
  const result = new Map();
  for (const [key, setValue] of value.entries()) {
    result.set(key, new Set(setValue));
  }
  return result;
}

function cloneMap(value) {
  return new Map(value.entries());
}

function cloneMapOfArrays(value) {
  const result = new Map();
  for (const [key, arrayValue] of value.entries()) {
    result.set(key, [...arrayValue]);
  }
  return result;
}

function toLeafName(path) {
  if (!path) {
    return '';
  }
  const parts = path.split('/');
  return parts.at(-1) || '';
}

export function getAncestorPaths(path) {
  if (typeof path !== 'string' || path.length === 0) {
    return [];
  }

  const parts = path.split('/');
  if (parts.length <= 1) {
    return [];
  }

  const ancestors = [];
  let currentPath = '';
  for (let index = 0; index < parts.length - 1; index += 1) {
    currentPath = index === 0 ? parts[index] : `${currentPath}/${parts[index]}`;
    ancestors.push(currentPath);
  }

  return ancestors;
}

export function createRepositoryEntry(input = {}) {
  return {
    path: input.path || '',
    name: input.name || toLeafName(input.path || ''),
    kind: input.kind || 'file',
    depth: Number.isInteger(input.depth) ? input.depth : 0,
    isText: input.isText === true,
    size: typeof input.size === 'number' ? input.size : 0,
    lines: typeof input.lines === 'number' ? input.lines : null,
    metadata: input.metadata || {}
  };
}

export function createRepositoryIndex(input = {}) {
  return {
    entriesByPath: input.entriesByPath ? cloneMap(input.entriesByPath) : new Map(),
    ancestorsByPath: input.ancestorsByPath ? cloneMapOfArrays(input.ancestorsByPath) : new Map(),
    parentPathByPath: input.parentPathByPath ? cloneMap(input.parentPathByPath) : new Map(),
    childPathsByDirectory: input.childPathsByDirectory
      ? cloneMapOfSets(input.childPathsByDirectory)
      : new Map(),
    directChildPathsByDirectory: input.directChildPathsByDirectory
      ? cloneMapOfSets(input.directChildPathsByDirectory)
      : new Map(),
    textFilesByPath: input.textFilesByPath ? cloneMap(input.textFilesByPath) : new Map()
  };
}

export function addRepositoryEntry(index, rawEntry) {
  const entry = createRepositoryEntry(rawEntry);
  const ancestors = getAncestorPaths(entry.path);
  const parentPath = ancestors.length > 0 ? ancestors.at(-1) : null;

  index.entriesByPath.set(entry.path, entry);
  index.ancestorsByPath.set(entry.path, ancestors);
  index.parentPathByPath.set(entry.path, parentPath);

  if (entry.kind === 'directory' && !index.childPathsByDirectory.has(entry.path)) {
    index.childPathsByDirectory.set(entry.path, new Set());
  }
  if (entry.kind === 'directory' && !index.directChildPathsByDirectory.has(entry.path)) {
    index.directChildPathsByDirectory.set(entry.path, new Set());
  }

  if (parentPath) {
    if (!index.directChildPathsByDirectory.has(parentPath)) {
      index.directChildPathsByDirectory.set(parentPath, new Set());
    }
    index.directChildPathsByDirectory.get(parentPath).add(entry.path);
  }

  for (const ancestorPath of ancestors) {
    if (!index.childPathsByDirectory.has(ancestorPath)) {
      index.childPathsByDirectory.set(ancestorPath, new Set());
    }
    index.childPathsByDirectory.get(ancestorPath).add(entry.path);
  }

  if (entry.kind === 'file' && entry.isText) {
    index.textFilesByPath.set(entry.path, entry);
  }

  return index;
}

export function getRepositoryEntry(index, path) {
  return index.entriesByPath.get(path) || null;
}

export function listTextFilePaths(index) {
  return Array.from(index.textFilesByPath.keys()).sort((left, right) => left.localeCompare(right));
}

export function listRootPaths(index) {
  return Array.from(index.entriesByPath.keys())
    .filter((path) => index.parentPathByPath.get(path) === null)
    .sort((left, right) => {
      const leftEntry = index.entriesByPath.get(left);
      const rightEntry = index.entriesByPath.get(right);
      if (leftEntry.kind === rightEntry.kind) {
        return leftEntry.name.localeCompare(rightEntry.name);
      }
      return leftEntry.kind === 'directory' ? -1 : 1;
    });
}
