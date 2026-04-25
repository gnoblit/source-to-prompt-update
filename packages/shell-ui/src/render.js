import { renderProfileControls } from './profile-ui.js';

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

const VIRTUAL_TREE_ROW_THRESHOLD = 250;
const VIRTUAL_TREE_ROW_HEIGHT = 44;
const VIRTUAL_TREE_OVERSCAN = 10;
const virtualTreeStateByElement = new WeakMap();

function formatLineSummary({ selectedKnownLines, selectedUnknownLineFiles }) {
  if (selectedUnknownLineFiles > 0) {
    return `${selectedKnownLines.toLocaleString()} + ?`;
  }
  return selectedKnownLines.toLocaleString();
}

function formatTokenEstimate(tokens = 0) {
  return tokens.toLocaleString();
}

function getStatusClass(type) {
  if (type === 'error') return 'status-message error';
  if (type === 'success') return 'status-message success';
  if (type === 'info') return 'status-message info';
  return 'status-message';
}

function getBulkSelectionButtonState(state, viewModel) {
  const index = state.repository.snapshot?.index || null;
  const targetPaths = state.filter.query
    ? Array.from(viewModel.folderStats.filterVisibleFilePaths)
    : Array.from(index?.textFilesByPath?.keys?.() || []);

  const selectedCount = targetPaths.filter((path) => state.selection.selectedPaths.has(path)).length;
  const targetCount = targetPaths.length;
  const allSelected = targetCount > 0 && selectedCount === targetCount;
  const scopeLabel = state.filter.query ? 'Visible' : 'All';

  return {
    disabled: !index || targetCount === 0,
    label: allSelected
      ? `Deselect ${scopeLabel} Text Files`
      : `Select ${scopeLabel} Text Files`
  };
}

function getFolderCheckboxState(folderStats, folderPath) {
  const visibleCount = folderStats.folderVisibleFileCount.get(folderPath) || 0;
  const selectedVisibleCount = folderStats.folderSelectedVisibleFileCount.get(folderPath) || 0;

  return {
    visibleCount,
    selectedVisibleCount,
    checked: visibleCount > 0 && selectedVisibleCount === visibleCount,
    indeterminate: selectedVisibleCount > 0 && selectedVisibleCount < visibleCount
  };
}

function createTreeRow(documentObject, row, renderContext) {
  const { state, folderStats } = renderContext;
  const rowElement = documentObject.createElement('div');
  rowElement.className = 'tree-row';
  rowElement.style.setProperty('--depth', String(row.depth));

  const toggle = documentObject.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tree-toggle';

  if (row.kind === 'directory') {
    const expanded = state.ui.expandedFolders.has(row.path);
    toggle.textContent = expanded ? '▾' : '▸';
    toggle.dataset.action = 'toggle-folder';
    toggle.dataset.path = row.path;
  } else {
    toggle.textContent = '';
    toggle.disabled = true;
  }
  rowElement.appendChild(toggle);

  const checkbox = documentObject.createElement('input');
  checkbox.type = 'checkbox';

  if (row.kind === 'directory') {
    const folderState = getFolderCheckboxState(folderStats, row.path);
    checkbox.checked = folderState.checked;
    checkbox.indeterminate = folderState.indeterminate;
    checkbox.dataset.action = 'folder-select';
    checkbox.dataset.path = row.path;
  } else if (row.isText) {
    const selected = state.selection.selectedPaths.has(row.path);
    checkbox.checked = selected;
    checkbox.dataset.action = 'file-select';
    checkbox.dataset.path = row.path;
  } else {
    checkbox.disabled = true;
  }

  rowElement.appendChild(checkbox);

  const label = documentObject.createElement('div');
  label.className = `tree-label ${row.isText || row.kind === 'directory' ? '' : 'muted'}`.trim();

  if (row.kind === 'directory') {
    const folderState = getFolderCheckboxState(folderStats, row.path);
    label.textContent = `📁 ${row.name} (${folderState.selectedVisibleCount}/${folderState.visibleCount})`;
  } else if (row.isText) {
    const linesText = typeof row.lines === 'number' ? ` | ${row.lines.toLocaleString()} lines` : '';
    label.textContent = `📄 ${row.name} (${formatKilobytes(row.size)}${linesText})`;
  } else {
    label.textContent = `📄 ${row.name} (non-text file)`;
  }

  rowElement.appendChild(label);
  return rowElement;
}

function createLargestFileRow(documentObject, row, state) {
  const rowElement = documentObject.createElement('div');
  rowElement.className = 'largest-file-row';

  const checkbox = documentObject.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = state.selection.selectedPaths.has(row.path);
  checkbox.dataset.action = 'file-select';
  checkbox.dataset.path = row.path;
  rowElement.appendChild(checkbox);

  const path = documentObject.createElement('div');
  path.className = 'largest-file-path';
  path.textContent = row.path;
  rowElement.appendChild(path);

  const size = documentObject.createElement('div');
  size.className = 'largest-file-size';
  size.textContent = formatKilobytes(row.size);
  rowElement.appendChild(size);

  return rowElement;
}

function createCompactMetricRow(documentObject, { label, value }) {
  const rowElement = documentObject.createElement('div');
  rowElement.className = 'compact-metric-row';

  const labelElement = documentObject.createElement('span');
  labelElement.textContent = label;
  rowElement.appendChild(labelElement);

  const valueElement = documentObject.createElement('strong');
  valueElement.textContent = value;
  rowElement.appendChild(valueElement);

  return rowElement;
}

function createWarningRow(documentObject, warning) {
  const rowElement = documentObject.createElement('div');
  rowElement.className = `selection-warning ${warning.level || 'info'}`;
  rowElement.textContent = warning.message;
  return rowElement;
}

function createSelectedFileRow(documentObject, row) {
  return createCompactMetricRow(documentObject, {
    label: row.path,
    value: formatKilobytes(row.size)
  });
}

function createEmptyRow(documentObject, text) {
  const rowElement = documentObject.createElement('div');
  rowElement.className = 'compact-empty-row';
  rowElement.textContent = text;
  return rowElement;
}

function renderCompactRows(documentObject, element, rows, emptyText, rowFactory) {
  if (!element) {
    return;
  }

  if (!rows || rows.length === 0) {
    element.replaceChildren(createEmptyRow(documentObject, emptyText));
    return;
  }

  element.replaceChildren(...rows.map((row) => rowFactory(documentObject, row)));
}

function renderLargestFiles(documentObject, elements, state, viewModel) {
  if (!elements.largestFilesList || !elements.largestFilesSummary) {
    return;
  }

  const largestFiles = viewModel.largestFiles || [];
  elements.largestFilesSummary.textContent = state.repository.snapshot
    ? `${largestFiles.length} shown by size`
    : 'No repository loaded.';

  if (largestFiles.length === 0) {
    const empty = documentObject.createElement('div');
    empty.className = 'largest-file-empty';
    empty.textContent = state.repository.snapshot ? 'No text files found.' : 'Load a repository first.';
    elements.largestFilesList.replaceChildren(empty);
    return;
  }

  elements.largestFilesList.replaceChildren(
    ...largestFiles.map((row) => createLargestFileRow(documentObject, row, state))
  );
}

function renderSelectionInsights(documentObject, elements, viewModel) {
  const insights = viewModel.selectionInsights || {};
  if (elements.selectionReviewFiles) {
    elements.selectionReviewFiles.textContent = String(insights.selectedFileCount || 0);
  }
  if (elements.selectionReviewSize) {
    elements.selectionReviewSize.textContent = formatKilobytes(insights.selectedTotalBytes || 0);
  }
  if (elements.selectionReviewTokens) {
    elements.selectionReviewTokens.textContent = formatTokenEstimate(insights.estimatedTokens || 0);
  }

  renderCompactRows(
    documentObject,
    elements.selectionReviewWarnings,
    insights.warnings || [],
    'No warnings for the current selection.',
    createWarningRow
  );
  renderCompactRows(
    documentObject,
    elements.selectionLargestSelectedList,
    insights.largestSelectedFiles || [],
    'No selected text files.',
    createSelectedFileRow
  );
  renderCompactRows(
    documentObject,
    elements.selectionTypeBreakdown,
    insights.fileTypeBreakdown || [],
    'No selected text files.',
    (doc, row) => createCompactMetricRow(doc, {
      label: `${row.label} (${row.fileCount})`,
      value: formatKilobytes(row.totalBytes)
    })
  );
  renderCompactRows(
    documentObject,
    elements.selectionDirectoryBreakdown,
    insights.directoryBreakdown || [],
    'No selected text files.',
    (doc, row) => createCompactMetricRow(doc, {
      label: `${row.label} (${row.fileCount})`,
      value: formatKilobytes(row.totalBytes)
    })
  );
}

function renderDirectTreeRows(documentObject, elements, state, viewModel) {
  const previousState = virtualTreeStateByElement.get(elements.treeList);
  if (previousState) {
    virtualTreeStateByElement.set(elements.treeList, {
      ...previousState,
      active: false,
      rows: []
    });
  }
  elements.treeList.replaceChildren(
    ...viewModel.treeView.visibleRows.map((row) =>
      createTreeRow(documentObject, row, {
        state,
        folderStats: viewModel.folderStats
      })
    )
  );
}

function renderVirtualTreeWindow(treeList) {
  const virtualState = virtualTreeStateByElement.get(treeList);
  if (!virtualState || virtualState.active === false) {
    return;
  }

  const {
    documentObject,
    rows,
    appState,
    folderStats
  } = virtualState;
  const viewportHeight = treeList.clientHeight || VIRTUAL_TREE_ROW_HEIGHT * 14;
  const scrollTop = treeList.scrollTop || 0;
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_TREE_ROW_HEIGHT) - VIRTUAL_TREE_OVERSCAN);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / VIRTUAL_TREE_ROW_HEIGHT) + VIRTUAL_TREE_OVERSCAN
  );
  const topSpacer = documentObject.createElement('div');
  topSpacer.className = 'tree-virtual-spacer';
  topSpacer.style.height = `${startIndex * VIRTUAL_TREE_ROW_HEIGHT}px`;

  const bottomSpacer = documentObject.createElement('div');
  bottomSpacer.className = 'tree-virtual-spacer';
  bottomSpacer.style.height = `${Math.max(0, (rows.length - endIndex) * VIRTUAL_TREE_ROW_HEIGHT)}px`;

  const renderedRows = rows
    .slice(startIndex, endIndex)
    .map((row) => createTreeRow(documentObject, row, {
      state: appState,
      folderStats
    }));

  treeList.replaceChildren(topSpacer, ...renderedRows, bottomSpacer);
}

function renderVirtualTreeRows(documentObject, elements, state, viewModel) {
  const treeList = elements.treeList;
  const previousState = virtualTreeStateByElement.get(treeList);
  const nextState = {
    ...(previousState || {}),
    documentObject,
    rows: viewModel.treeView.visibleRows,
    appState: state,
    folderStats: viewModel.folderStats,
    active: true
  };
  virtualTreeStateByElement.set(treeList, nextState);

  if (!previousState?.scrollListenerAttached && typeof treeList.addEventListener === 'function') {
    treeList.addEventListener('scroll', () => renderVirtualTreeWindow(treeList));
    nextState.scrollListenerAttached = true;
  }

  renderVirtualTreeWindow(treeList);
}

function renderTreeRows(documentObject, elements, state, viewModel) {
  if (viewModel.treeView.visibleRows.length > VIRTUAL_TREE_ROW_THRESHOLD) {
    renderVirtualTreeRows(documentObject, elements, state, viewModel);
    return;
  }

  renderDirectTreeRows(documentObject, elements, state, viewModel);
}

export function renderBrowserShell({
  documentObject = globalThis.document,
  elements,
  controller,
  restoreState = { supported: false, hasSavedRepository: false },
  status = null,
  diagnosticsText = 'No diagnostics yet.'
} = {}) {
  const state = controller.getState();
  const viewModel = controller.getViewModel();

  elements.selectedRepositoryName.textContent =
    state.repository.snapshot?.rootName || 'No repository selected';
  elements.scanPhaseText.textContent = state.repository.scanStatus.progress
    ? `Phase: ${state.repository.scanStatus.phase} | Processed: ${state.repository.scanStatus.progress.processedEntries}`
    : `Phase: ${state.repository.scanStatus.phase}`;
  if (state.ui.activeTask?.message) {
    elements.scanPhaseText.textContent = state.ui.activeTask.message;
  }

  if (status) {
    elements.statusMessage.className = getStatusClass(status.type);
    elements.statusMessage.textContent = status.message;
  } else {
    elements.statusMessage.className = 'status-message';
    elements.statusMessage.textContent = '';
  }

  elements.selectedSizeText.textContent = formatKilobytes(viewModel.tally.selectedTotalSize);
  elements.selectedLinesText.textContent = formatLineSummary(viewModel.tally);
  elements.visibleRowsText.textContent = String(viewModel.treeView.visibleRows.length);
  elements.treeSummaryText.textContent = state.repository.snapshot
    ? `${viewModel.treeView.visibleRows.length} visible rows, ${viewModel.folderStats.filterVisibleFilePaths.size} visible text files`
    : 'No repository loaded.';

  elements.filterInput.value = state.filter.query;
  if (elements.ignorePatternsInput) {
    elements.ignorePatternsInput.value = state.options.ignorePatterns || '';
  }
  if (elements.ignorePatternsStatus) {
    elements.ignorePatternsStatus.textContent = state.options.ignorePatterns?.trim()
      ? 'Custom ignore patterns active'
      : 'Using .gitignore and defaults';
  }
  elements.includePreamble.checked = state.options.includePreamble;
  elements.preambleInput.value = state.options.customPreamble;
  elements.includeGoal.checked = state.options.includeGoal;
  elements.goalInput.value = state.options.goalText;
  elements.removeCommentsToggle.checked = state.options.transforms.removeComments === true;
  elements.minifyOutputToggle.checked = state.options.transforms.minifyOutput === true;
  if (elements.guardrailWarningKbInput) {
    elements.guardrailWarningKbInput.value = String(
      Math.round((viewModel.selectionInsights.guardrails.warningByteLimit || 0) / 1024)
    );
  }
  if (elements.guardrailConfirmationKbInput) {
    elements.guardrailConfirmationKbInput.value = String(
      Math.round((viewModel.selectionInsights.guardrails.confirmationByteLimit || 0) / 1024)
    );
  }
  const nextOutputPreview = state.output.previewText || '';
  if (elements.outputTextarea.value !== nextOutputPreview) {
    elements.outputTextarea.value = nextOutputPreview;
    elements.outputTextarea.scrollTop = 0;
    elements.outputTextarea.scrollLeft = 0;
  }
  if (elements.outputSummaryText) {
    elements.outputSummaryText.textContent =
      state.output.summaryText || 'Combined output will appear here.';
  }

  renderLargestFiles(documentObject, elements, state, viewModel);
  renderSelectionInsights(documentObject, elements, viewModel);

  renderProfileControls({
    documentObject,
    elements,
    viewModel
  });

  elements.refreshFolderBtn.disabled = !state.session.repositoryHandle;
  if (elements.cancelTaskBtn) {
    elements.cancelTaskBtn.disabled = !state.ui.activeTask || state.ui.activeTask.cancelling === true;
  }
  const bulkSelectionButtonState = getBulkSelectionButtonState(state, viewModel);
  elements.toggleVisibleBtn.disabled = bulkSelectionButtonState.disabled;
  elements.toggleVisibleBtn.textContent = bulkSelectionButtonState.label;
  if (elements.restoreFolderBtn) {
    elements.restoreFolderBtn.disabled =
      restoreState.supported !== true || restoreState.hasSavedRepository !== true;
  }
  elements.saveProfileBtn.disabled =
    !state.session.repositoryHandle || !elements.profileNameInput.value.trim();
  elements.combineBtn.disabled = !viewModel.combineEnabled;
  if (state.ui.activeTask) {
    elements.combineBtn.disabled = true;
    elements.selectFolderBtn.disabled = true;
    elements.refreshFolderBtn.disabled = true;
    elements.toggleVisibleBtn.disabled = true;
  }
  if (elements.clearOutputBtn) {
    elements.clearOutputBtn.disabled = !state.output.renderedText;
  }
  elements.copyOutputBtn.disabled = !state.output.renderedText || state.output.copyAllowed !== true;
  elements.copyOutputBtn.textContent =
    state.output.renderedText && state.output.copyAllowed !== true ? 'Copy Too Large' : 'Copy';
  elements.downloadOutputBtn.disabled = !state.output.renderedText;
  elements.saveOutputBtn.disabled = !state.output.renderedText;

  renderTreeRows(documentObject, elements, state, viewModel);

  elements.diagnosticsLog.textContent = diagnosticsText;
}

export const renderShell = renderBrowserShell;
