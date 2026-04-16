function cloneSet(input) {
  return input ? new Set(input) : new Set();
}

export function normalizeFilterQuery(query) {
  return typeof query === 'string' ? query.toLowerCase().trim() : '';
}

export function applyPathFilter({ allPaths = [], query = '', pathExists = null } = {}) {
  const normalizedQuery = normalizeFilterQuery(query);
  const filterVisiblePaths = new Set();

  if (!normalizedQuery) {
    for (const path of allPaths) {
      filterVisiblePaths.add(path);
    }

    return {
      query: normalizedQuery,
      filterQueryActive: false,
      filterVisiblePaths
    };
  }

  const hasPath = typeof pathExists === 'function'
    ? pathExists
    : (path) => allPaths.includes(path);

  for (const path of allPaths) {
    if (!path.toLowerCase().includes(normalizedQuery)) {
      continue;
    }

    const parts = path.split('/');
    let currentPath = '';
    for (let index = 0; index < parts.length; index += 1) {
      currentPath = index === 0 ? parts[index] : `${currentPath}/${parts[index]}`;
      if (hasPath(currentPath)) {
        filterVisiblePaths.add(currentPath);
      }
    }
  }

  return {
    query: normalizedQuery,
    filterQueryActive: true,
    filterVisiblePaths
  };
}

export function computeRenderedRows({
  rows = [],
  filterVisiblePaths = new Set(),
  ancestorsByPath = new Map(),
  collapsedFolders = new Set(),
  filterQueryActive = false
} = {}) {
  const rowVisibilityByPath = new Map();
  const visibleRows = [];

  for (const row of rows) {
    let isVisible = filterVisiblePaths.has(row.path);

    if (isVisible && !filterQueryActive) {
      const ancestors = ancestorsByPath.get(row.path) || [];
      for (const ancestorPath of ancestors) {
        if (collapsedFolders.has(ancestorPath)) {
          isVisible = false;
          break;
        }
      }
    }

    rowVisibilityByPath.set(row.path, isVisible);
    if (isVisible) {
      visibleRows.push(row);
    }
  }

  return {
    visibleRows,
    rowVisibilityByPath
  };
}

export function copyFilterVisiblePaths(filterVisiblePaths) {
  return cloneSet(filterVisiblePaths);
}
