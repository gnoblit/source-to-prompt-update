import { renderProfileControls } from './profile-ui.js';

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function formatLineSummary({ selectedKnownLines, selectedUnknownLineFiles }) {
  if (selectedUnknownLineFiles > 0) {
    return `${selectedKnownLines.toLocaleString()} + ?`;
  }
  return selectedKnownLines.toLocaleString();
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

function createTreeRow(documentObject, row, controller) {
  const rowElement = documentObject.createElement('div');
  rowElement.className = 'tree-row';
  rowElement.style.setProperty('--depth', String(row.depth));

  const toggle = documentObject.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tree-toggle';

  if (row.kind === 'directory') {
    const expanded = controller.getState().ui.expandedFolders.has(row.path);
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
    const folderState = controller.getFolderCheckboxState(row.path);
    checkbox.checked = folderState.checked;
    checkbox.indeterminate = folderState.indeterminate;
    checkbox.dataset.action = 'folder-select';
    checkbox.dataset.path = row.path;
  } else if (row.isText) {
    const selected = controller.getState().selection.selectedPaths.has(row.path);
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
    const folderState = controller.getFolderCheckboxState(row.path);
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
  elements.includePreamble.checked = state.options.includePreamble;
  elements.preambleInput.value = state.options.customPreamble;
  elements.includeGoal.checked = state.options.includeGoal;
  elements.goalInput.value = state.options.goalText;
  elements.removeCommentsToggle.checked = state.options.transforms.removeComments === true;
  elements.minifyOutputToggle.checked = state.options.transforms.minifyOutput === true;
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

  renderProfileControls({
    documentObject,
    elements,
    viewModel
  });

  elements.refreshFolderBtn.disabled = !state.session.repositoryHandle;
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
  if (elements.clearOutputBtn) {
    elements.clearOutputBtn.disabled = !state.output.renderedText;
  }
  elements.copyOutputBtn.disabled = !state.output.renderedText || state.output.copyAllowed !== true;
  elements.copyOutputBtn.textContent =
    state.output.renderedText && state.output.copyAllowed !== true ? 'Copy Too Large' : 'Copy';
  elements.downloadOutputBtn.disabled = !state.output.renderedText;
  elements.saveOutputBtn.disabled = !state.output.renderedText;

  elements.treeList.replaceChildren(
    ...viewModel.treeView.visibleRows.map((row) =>
      createTreeRow(documentObject, row, controller)
    )
  );

  elements.diagnosticsLog.textContent = diagnosticsText;
}

export const renderShell = renderBrowserShell;
