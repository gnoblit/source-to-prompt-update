import {
  applyPathFilter,
  computeRenderedRows
} from '../../../core/src/selection/filter-engine.js';
import { computeFolderSelectionStats } from '../../../core/src/selection/selection-engine.js';
import { listRootPaths } from '../../../core/src/models/repository-index.js';

function getIndex(state) {
  return state?.repository?.snapshot?.index || null;
}

function getExtensionLabel(path = '') {
  const leafName = String(path).split('/').at(-1) || '';
  const dotIndex = leafName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === leafName.length - 1) {
    return 'no extension';
  }
  return leafName.slice(dotIndex).toLowerCase();
}

function getTopDirectoryLabel(path = '') {
  const parts = String(path).split('/').filter(Boolean);
  return parts.length > 1 ? parts[0] : '(root)';
}

function estimateTokensForBytes(bytes = 0) {
  return Math.ceil(Math.max(0, bytes) / 4);
}

function getGuardrailLimits(state) {
  const guardrails = state?.options?.guardrails || {};
  const warningByteLimit =
    typeof guardrails.warningByteLimit === 'number' && guardrails.warningByteLimit > 0
      ? guardrails.warningByteLimit
      : 512 * 1024;
  const confirmationByteLimit =
    typeof guardrails.confirmationByteLimit === 'number' && guardrails.confirmationByteLimit > 0
      ? guardrails.confirmationByteLimit
      : 2 * 1024 * 1024;

  return {
    warningByteLimit,
    confirmationByteLimit
  };
}

function sortChildEntries(index, childPaths = []) {
  return [...childPaths].sort((left, right) => {
    const leftEntry = index.entriesByPath.get(left);
    const rightEntry = index.entriesByPath.get(right);
    if (leftEntry.kind === rightEntry.kind) {
      return leftEntry.name.localeCompare(rightEntry.name);
    }
    return leftEntry.kind === 'directory' ? -1 : 1;
  });
}

function walkTree(index, path, rows) {
  const entry = index.entriesByPath.get(path);
  if (!entry) {
    return;
  }

  rows.push({
    path: entry.path,
    name: entry.name,
    kind: entry.kind,
    depth: entry.depth,
    isText: entry.isText,
    size: entry.size,
    lines: entry.lines
  });

  if (entry.kind !== 'directory') {
    return;
  }

  const childPaths = sortChildEntries(
    index,
    index.directChildPathsByDirectory.get(path) || []
  );
  for (const childPath of childPaths) {
    walkTree(index, childPath, rows);
  }
}

export function selectTreeRows(state) {
  const index = getIndex(state);
  if (!index) {
    return [];
  }

  const rows = [];
  for (const rootPath of listRootPaths(index)) {
    walkTree(index, rootPath, rows);
  }
  return rows;
}

export function selectCollapsedFolders(state) {
  const index = getIndex(state);
  if (!index) {
    return new Set();
  }

  const expandedFolders = state?.ui?.expandedFolders || new Set();
  const collapsed = new Set();
  for (const entry of index.entriesByPath.values()) {
    if (entry.kind === 'directory' && !expandedFolders.has(entry.path)) {
      collapsed.add(entry.path);
    }
  }
  return collapsed;
}

export function selectTreeView(state) {
  const index = getIndex(state);
  if (!index) {
    return {
      rows: [],
      visibleRows: [],
      filterVisiblePaths: new Set(),
      rowVisibilityByPath: new Map(),
      filterQueryActive: false
    };
  }

  const rows = selectTreeRows(state);
  const allPaths = rows.map((row) => row.path);
  const filterResult = applyPathFilter({
    allPaths,
    query: state?.filter?.query || '',
    pathExists: (path) => index.entriesByPath.has(path)
  });
  const renderResult = computeRenderedRows({
    rows,
    filterVisiblePaths: filterResult.filterVisiblePaths,
    ancestorsByPath: index.ancestorsByPath,
    collapsedFolders: selectCollapsedFolders(state),
    filterQueryActive: filterResult.filterQueryActive
  });

  return {
    rows,
    visibleRows: renderResult.visibleRows,
    filterVisiblePaths: filterResult.filterVisiblePaths,
    rowVisibilityByPath: renderResult.rowVisibilityByPath,
    filterQueryActive: filterResult.filterQueryActive
  };
}

export function selectSelectionTally(state) {
  const index = getIndex(state);
  if (!index) {
    return {
      selectedTotalSize: 0,
      selectedKnownLines: 0,
      selectedUnknownLineFiles: 0
    };
  }

  let selectedTotalSize = 0;
  let selectedKnownLines = 0;
  let selectedUnknownLineFiles = 0;

  for (const path of state?.selection?.selectedPaths || []) {
    const entry = index.textFilesByPath.get(path);
    if (!entry) {
      continue;
    }

    selectedTotalSize += entry.size || 0;
    if (typeof entry.lines === 'number') {
      selectedKnownLines += entry.lines;
    } else {
      selectedUnknownLineFiles += 1;
    }
  }

  return {
    selectedTotalSize,
    selectedKnownLines,
    selectedUnknownLineFiles
  };
}

export function selectLargestTextFiles(state, { limit = 8 } = {}) {
  const index = getIndex(state);
  if (!index) {
    return [];
  }

  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 8;
  return Array.from(index.textFilesByPath.values())
    .sort((left, right) => {
      const sizeDelta = (right.size || 0) - (left.size || 0);
      return sizeDelta || left.path.localeCompare(right.path);
    })
    .slice(0, normalizedLimit)
    .map((entry) => ({
      path: entry.path,
      name: entry.name,
      kind: entry.kind,
      isText: entry.isText,
      size: entry.size,
      lines: entry.lines
    }));
}

function pushBreakdownEntry(map, key, size) {
  const previous = map.get(key) || { label: key, fileCount: 0, totalBytes: 0 };
  previous.fileCount += 1;
  previous.totalBytes += size || 0;
  map.set(key, previous);
}

function sortBreakdown(map, limit = 6) {
  return Array.from(map.values())
    .sort((left, right) => {
      const sizeDelta = right.totalBytes - left.totalBytes;
      return sizeDelta || left.label.localeCompare(right.label);
    })
    .slice(0, limit);
}

export function selectSelectionInsights(state, { limit = 8 } = {}) {
  const index = getIndex(state);
  const guardrails = getGuardrailLimits(state);
  if (!index) {
    return {
      selectedFileCount: 0,
      selectedTotalBytes: 0,
      estimatedTokens: 0,
      largestSelectedFiles: [],
      fileTypeBreakdown: [],
      directoryBreakdown: [],
      warnings: [],
      guardrails
    };
  }

  const selectedFiles = [];
  const fileTypeMap = new Map();
  const directoryMap = new Map();
  let selectedTotalBytes = 0;

  for (const path of state?.selection?.selectedPaths || []) {
    const entry = index.textFilesByPath.get(path);
    if (!entry) {
      continue;
    }

    const size = entry.size || 0;
    selectedTotalBytes += size;
    selectedFiles.push({
      path: entry.path,
      name: entry.name,
      size,
      lines: entry.lines
    });
    pushBreakdownEntry(fileTypeMap, getExtensionLabel(entry.path), size);
    pushBreakdownEntry(directoryMap, getTopDirectoryLabel(entry.path), size);
  }

  const largestSelectedFiles = selectedFiles
    .sort((left, right) => {
      const sizeDelta = right.size - left.size;
      return sizeDelta || left.path.localeCompare(right.path);
    })
    .slice(0, Number.isInteger(limit) && limit > 0 ? limit : 8);

  const warnings = [];
  if (selectedFiles.length === 0) {
    warnings.push({
      kind: 'empty-selection',
      level: 'info',
      message: 'Select at least one text file before generating.'
    });
  }
  if (selectedTotalBytes >= guardrails.confirmationByteLimit) {
    warnings.push({
      kind: 'confirmation-threshold',
      level: 'danger',
      message: `Selection is above the confirmation threshold.`
    });
  } else if (selectedTotalBytes >= guardrails.warningByteLimit) {
    warnings.push({
      kind: 'warning-threshold',
      level: 'warning',
      message: `Selection is above the warning threshold.`
    });
  }

  const largestFile = largestSelectedFiles[0] || null;
  if (largestFile && selectedTotalBytes > 0 && largestFile.size / selectedTotalBytes >= 0.5) {
    warnings.push({
      kind: 'dominant-file',
      level: 'warning',
      message: `${largestFile.path} accounts for at least half of the selected bytes.`
    });
  }

  return {
    selectedFileCount: selectedFiles.length,
    selectedTotalBytes,
    estimatedTokens: estimateTokensForBytes(selectedTotalBytes),
    largestSelectedFiles,
    fileTypeBreakdown: sortBreakdown(fileTypeMap),
    directoryBreakdown: sortBreakdown(directoryMap),
    warnings,
    guardrails
  };
}

export function selectFolderSelectionStats(state, treeView = null) {
  const index = getIndex(state);
  if (!index) {
    return {
      visibleFilePaths: new Set(),
      filterVisibleFilePaths: new Set(),
      folderVisibleFileCount: new Map(),
      folderSelectedVisibleFileCount: new Map()
    };
  }

  const resolvedTreeView = treeView || selectTreeView(state);
  const folderPaths = [];
  for (const entry of index.entriesByPath.values()) {
    if (entry.kind === 'directory') {
      folderPaths.push(entry.path);
    }
  }

  return computeFolderSelectionStats({
    folderPaths,
    filePaths: Array.from(index.textFilesByPath.keys()),
    filterVisiblePaths: resolvedTreeView.filterVisiblePaths,
    rowVisibilityByPath: resolvedTreeView.rowVisibilityByPath,
    selectedPaths: state?.selection?.selectedPaths || new Set(),
    ancestorsByFilePath: index.ancestorsByPath
  });
}

export function selectFolderCheckboxState(state, folderPath) {
  const stats = selectFolderSelectionStats(state);
  const visibleCount = stats.folderVisibleFileCount.get(folderPath) || 0;
  const selectedVisibleCount = stats.folderSelectedVisibleFileCount.get(folderPath) || 0;

  return {
    visibleCount,
    selectedVisibleCount,
    checked: visibleCount > 0 && selectedVisibleCount === visibleCount,
    indeterminate: selectedVisibleCount > 0 && selectedVisibleCount < visibleCount
  };
}

export function getCombineEligibility(state) {
  return Boolean(state?.selection?.selectedPaths && state.selection.selectedPaths.size > 0);
}
