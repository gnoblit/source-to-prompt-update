import { getShellElements } from './elements.js';
import { renderShell } from './render.js';

function sanitizeFileName(fileName) {
  const fallback = 'combined_files.txt';
  let value = typeof fileName === 'string' ? fileName.trim() : fallback;

  if (!value) {
    value = fallback;
  }

  value = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\.+$/g, '');
  if (!value) {
    value = fallback;
  }
  if (!value.toLowerCase().endsWith('.txt')) {
    value += '.txt';
  }

  return value;
}

function summarizeDiagnosticError(error) {
  if (!error || typeof error !== 'object') {
    return {
      name: 'Error',
      message: String(error || '')
    };
  }

  return {
    name: typeof error.name === 'string' ? error.name : 'Error',
    message: typeof error.message === 'string' ? error.message : ''
  };
}

export function bootShellUI({
  bootApp,
  documentObject = globalThis.document,
  windowObject = globalThis.window,
  storage = globalThis.localStorage,
  startup = {}
} = {}) {
  if (typeof bootApp !== 'function') {
    throw new TypeError('bootShellUI requires a bootApp function');
  }

  const {
    autoRestoreSavedRepository = true,
    autoRestoreAllowsPrompt = false
  } = startup;

  const elements = getShellElements(documentObject);
  let diagnosticsEntries = [];
  let status = null;
  let hasSavedRepository = false;

  const app = bootApp({
    windowObject,
    storage,
    onDiagnosticsChange(entries) {
      diagnosticsEntries = entries;
      render();
    }
  });

  const { controller, hosts } = app;
  const disposers = [];

  function setStatus(message, type = 'info') {
    status = { message, type };
    render();
  }

  function clearStatus() {
    status = null;
    render();
  }

  function appendDiagnostic(event, details = {}) {
    hosts.diagnosticsHost?.append?.({ event, details });
  }

  async function refreshRestoreAvailability() {
    try {
      hasSavedRepository = await controller.hasSavedRepository();
    } catch {
      hasSavedRepository = false;
    }
    render();
  }

  function render() {
    renderShell({
      documentObject,
      elements,
      controller,
      restoreState: {
        supported: controller.supportsSavedRepositoryRestore(),
        hasSavedRepository
      },
      status,
      diagnosticsText:
        diagnosticsEntries.length > 0
          ? diagnosticsEntries
              .map((entry) => JSON.stringify(entry, null, 2))
              .join('\n\n')
          : 'No diagnostics yet.'
    });
  }

  controller.subscribe((event) => {
    if (event.type === 'repository-selected') {
      setStatus(`Loaded repository: ${event.payload.rootName}`, 'success');
      controller.rememberCurrentRepository().then(refreshRestoreAvailability).catch(() => {});
    } else if (event.type === 'repository-refreshed') {
      setStatus(`Refreshed repository: ${event.payload.rootName}`, 'success');
      controller.rememberCurrentRepository().then(refreshRestoreAvailability).catch(() => {});
    } else if (event.type === 'repository-restored') {
      setStatus(`Restored repository: ${event.payload.rootName}`, 'success');
    } else if (event.type === 'selection-combined') {
      const presentation = event.payload.outputPresentation || null;
      const warnings = [];

      if (presentation?.previewTruncated) {
        warnings.push('preview truncated');
      }
      if (presentation?.copyAllowed === false) {
        warnings.push('clipboard copy disabled');
      }

      setStatus(
        warnings.length > 0
          ? `Built prompt bundle for ${event.payload.fileCount} files; ${warnings.join(', ')}.`
          : `Built prompt bundle for ${event.payload.fileCount} files.`,
        'success'
      );
      appendDiagnostic('combine-complete', {
        fileCount: event.payload.fileCount,
        outputPresentation: presentation,
        transformExecution: event.payload.transformExecution || null
      });
    } else if (event.type === 'output-cleared') {
      render();
    } else if (event.type === 'scan-progress') {
      clearStatus();
    } else {
      render();
    }
  });

  elements.selectFolderBtn.addEventListener('click', async () => {
    try {
      appendDiagnostic('select-folder-click');
      await controller.selectRepository();
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Select folder');
      appendDiagnostic('select-folder-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.restoreFolderBtn?.addEventListener('click', async () => {
    try {
      appendDiagnostic('restore-folder-click');
      const restored = await controller.restoreSavedRepository({ allowPrompt: true });

      if (!restored.restored) {
        if (restored.reason === 'unsupported') {
          setStatus('Restore last folder is unavailable in this host.', 'info');
        } else if (restored.reason === 'missing') {
          setStatus('No saved repository is available to restore.', 'info');
        } else if (restored.reason === 'not-granted') {
          setStatus('Saved repository access was not granted.', 'info');
        } else {
          setStatus('Unable to restore the saved repository.', 'info');
        }
        return;
      }

      await refreshRestoreAvailability();
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Restore repository');
      appendDiagnostic('restore-folder-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.refreshFolderBtn.addEventListener('click', async () => {
    try {
      appendDiagnostic('refresh-click');
      await controller.refreshRepository();
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Refresh repository');
      appendDiagnostic('refresh-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.toggleVisibleBtn.addEventListener('click', () => {
    controller.toggleAllVisibleTextFiles();
  });

  elements.clearSelectionBtn.addEventListener('click', () => {
    controller.clearSelection();
  });

  elements.filterInput.addEventListener('input', () => {
    controller.setFilterQuery(elements.filterInput.value);
  });

  elements.profileNameInput.addEventListener('input', () => {
    render();
  });

  elements.profileSelect.addEventListener('change', () => {
    render();
  });

  elements.saveProfileBtn.addEventListener('click', async () => {
    try {
      appendDiagnostic('profile-save-click');
      const snapshot = await controller.saveProfile(elements.profileNameInput.value);
      elements.profileNameInput.value = '';
      setStatus(`Saved profile: ${snapshot.name}`, 'success');
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Save profile');
      appendDiagnostic('profile-save-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.loadProfileBtn.addEventListener('click', async () => {
    const profileId = elements.profileSelect.value;
    if (!profileId) {
      setStatus('Choose a profile to load.', 'info');
      return;
    }

    try {
      appendDiagnostic('profile-load-click', { profileId });
      const applied = await controller.loadProfile(profileId);
      const profileName =
        elements.profileSelect.selectedOptions?.[0]?.textContent || 'selected profile';

      if (applied.missingPaths.length > 0) {
        setStatus(
          `Loaded ${profileName}; skipped ${applied.missingPaths.length} missing paths.`,
          'info'
        );
      } else {
        setStatus(`Loaded profile: ${profileName}`, 'success');
      }
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Load profile');
      appendDiagnostic('profile-load-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.deleteProfileBtn.addEventListener('click', async () => {
    const profileId = elements.profileSelect.value;
    if (!profileId) {
      setStatus('Choose a profile to delete.', 'info');
      return;
    }

    try {
      appendDiagnostic('profile-delete-click', { profileId });
      const deleted = await controller.deleteProfile(profileId);
      setStatus(`Deleted profile: ${deleted.name}`, 'success');
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Delete profile');
      appendDiagnostic('profile-delete-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.includePreamble.addEventListener('change', () => {
    controller.setPromptOptions({ includePreamble: elements.includePreamble.checked });
  });

  elements.preambleInput.addEventListener('input', () => {
    controller.setPromptOptions({ customPreamble: elements.preambleInput.value });
  });

  elements.includeGoal.addEventListener('change', () => {
    controller.setPromptOptions({ includeGoal: elements.includeGoal.checked });
  });

  elements.goalInput.addEventListener('input', () => {
    controller.setPromptOptions({ goalText: elements.goalInput.value });
  });

  elements.removeCommentsToggle.addEventListener('change', () => {
    controller.setTransformOptions({
      removeComments: elements.removeCommentsToggle.checked
    });
  });

  elements.minifyOutputToggle.addEventListener('change', () => {
    controller.setTransformOptions({
      minifyOutput: elements.minifyOutputToggle.checked
    });
  });

  elements.treeList.addEventListener('click', (event) => {
    const target = event.target;
    const button = target.closest('button[data-action="toggle-folder"]');
    if (!button) {
      return;
    }

    controller.toggleFolderExpansion(button.dataset.path);
  });

  elements.treeList.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const action = target.dataset.action;
    const path = target.dataset.path;
    if (!action || !path) {
      return;
    }

    if (action === 'file-select') {
      controller.setFileSelection(path, target.checked, {
        clearFilterSelections: !target.checked
      });
      return;
    }

    if (action === 'folder-select') {
      controller.setFolderSelection(path, target.checked, {
        clearFilterSelections: !target.checked
      });
    }
  });

  elements.combineBtn.addEventListener('click', async () => {
    try {
      appendDiagnostic('combine-click');
      const result = await controller.combineSelection();
      if (elements.outputTextarea) {
        elements.outputTextarea.scrollTop = 0;
        elements.outputTextarea.scrollLeft = 0;
      }
      appendDiagnostic('combine-result', {
        transformPlan: result.transformPlan,
        transformExecution: result.transformExecution
      });
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Combine selection');
      appendDiagnostic('combine-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.clearOutputBtn?.addEventListener('click', () => {
    controller.clearOutput();
    if (elements.outputTextarea) {
      elements.outputTextarea.scrollTop = 0;
      elements.outputTextarea.scrollLeft = 0;
    }
    setStatus('Cleared generated output.', 'success');
  });

  elements.reloadAppBtn?.addEventListener('click', () => {
    appendDiagnostic('reload-app-click');

    if (windowObject?.location && typeof windowObject.location.reload === 'function') {
      windowObject.location.reload();
      return;
    }

    setStatus('Reload is unavailable in this host.', 'info');
  });

  elements.copyOutputBtn.addEventListener('click', async () => {
    try {
      const output = controller.getState().output;
      if (output.copyAllowed !== true) {
        setStatus('Output is too large to copy safely. Use Save As or Download instead.', 'info');
        return;
      }

      const text = output.renderedText;
      await hosts.outputHost.copyText(text);
      setStatus('Copied output to clipboard.', 'success');
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Copy output');
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.downloadOutputBtn.addEventListener('click', async () => {
    try {
      const text = controller.getState().output.renderedText;
      const fileName = sanitizeFileName(elements.outputFileNameInput.value);
      await hosts.outputHost.downloadText(text, fileName);
      setStatus(`Downloaded ${fileName}.`, 'success');
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Download output');
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.saveOutputBtn.addEventListener('click', async () => {
    try {
      const text = controller.getState().output.renderedText;
      const fileName = sanitizeFileName(elements.outputFileNameInput.value);
      const result = await hosts.outputHost.saveText(text, fileName);
      setStatus(
        result.mode === 'download'
          ? `Save As unavailable, downloaded ${result.fileName} instead.`
          : `Saved ${result.fileName}.`,
        result.mode === 'download' ? 'info' : 'success'
      );
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Save output');
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.copyDiagnosticsBtn?.addEventListener('click', async () => {
    const entries = hosts.diagnosticsHost?.exportEntries?.() || [];
    if (entries.length === 0) {
      setStatus('No diagnostics to copy yet.', 'info');
      return;
    }

    try {
      await hosts.outputHost.copyText(
        entries.map((entry) => JSON.stringify(entry, null, 2)).join('\n\n')
      );
      setStatus('Diagnostics copied to clipboard.', 'success');
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Copy diagnostics');
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
    }
  });

  elements.clearDiagnosticsBtn?.addEventListener('click', () => {
    hosts.diagnosticsHost?.clear?.();
    setStatus('Diagnostics cleared.', 'success');
  });

  controller.loadProfiles().catch((error) => {
    const normalized = controller.normalizeError(error, 'Load saved profiles');
    appendDiagnostic('profiles-load-error', normalized);
    setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
  });
  render();

  if (windowObject && typeof windowObject.addEventListener === 'function') {
    const onWindowError = (event) => {
      appendDiagnostic('window-error', {
        message: event && event.message ? String(event.message) : '',
        filename: event && event.filename ? String(event.filename) : '',
        line: event && typeof event.lineno === 'number' ? event.lineno : null,
        column: event && typeof event.colno === 'number' ? event.colno : null
      });
    };

    const onUnhandledRejection = (event) => {
      appendDiagnostic('unhandled-rejection', summarizeDiagnosticError(event?.reason));
    };

    windowObject.addEventListener('error', onWindowError);
    windowObject.addEventListener('unhandledrejection', onUnhandledRejection);
    disposers.push(() => {
      if (typeof windowObject.removeEventListener === 'function') {
        windowObject.removeEventListener('error', onWindowError);
        windowObject.removeEventListener('unhandledrejection', onUnhandledRejection);
      }
    });
  }

  (async () => {
    try {
      await refreshRestoreAvailability();
    } catch {
      hasSavedRepository = false;
      render();
      return;
    }

    if (
      autoRestoreSavedRepository !== true ||
      controller.supportsSavedRepositoryRestore() !== true ||
      hasSavedRepository !== true ||
      controller.getState().session.repositoryHandle
    ) {
      render();
      return;
    }

    try {
      appendDiagnostic('startup-restore-attempt', {
        allowPrompt: autoRestoreAllowsPrompt
      });

      const restored = await controller.restoreSavedRepository({
        allowPrompt: autoRestoreAllowsPrompt
      });

      if (restored.restored) {
        appendDiagnostic('startup-restore-complete', {
          reason: restored.reason
        });
        await refreshRestoreAvailability();
        return;
      }

      appendDiagnostic('startup-restore-skipped', {
        reason: restored.reason
      });

      if (restored.reason === 'not-granted') {
        setStatus(
          'Saved repository found. Use Restore Last Folder to re-grant access.',
          'info'
        );
        return;
      }
    } catch (error) {
      const normalized = controller.normalizeError(error, 'Startup restore');
      appendDiagnostic('startup-restore-error', normalized);
      setStatus(normalized.userMessage, normalized.cancelled ? 'info' : 'error');
      return;
    }

    render();
  })();

  app.dispose = () => {
    while (disposers.length > 0) {
      const dispose = disposers.pop();
      dispose?.();
    }
  };

  return app;
}

export function bootBrowserUI(options = {}) {
  return bootShellUI(options);
}
