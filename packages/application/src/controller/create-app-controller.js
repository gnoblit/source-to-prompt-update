import { getRepositoryEntry } from '../../../core/src/models/repository-index.js';
import {
  applyProfileToState,
  createProfileSnapshot,
  findProfileById,
  normalizeProfiles,
  removeProfile,
  upsertProfile
} from '../../../core/src/profiles/profiles-engine.js';
import { applySelectionChange, createSelectionState } from '../../../core/src/selection/selection-engine.js';
import {
  getCombineEligibility,
  selectFolderCheckboxState,
  selectFolderSelectionStats,
  selectSelectionTally,
  selectTreeView
} from '../selectors/index.js';
import { cloneAppState, createAppState } from '../state/create-app-state.js';
import {
  combineSelection as combineSelectionUseCase,
  normalizeUseCaseError,
  refreshRepository as refreshRepositoryUseCase,
  scanSelectedRepository,
  selectRepository as selectRepositoryUseCase
} from '../use-cases/index.js';

function sanitizeSelectionState(selectionState) {
  return {
    selectedPaths: new Set(selectionState.selectedPaths || []),
    filterSelectedPaths: new Set(selectionState.filterSelectedPaths || [])
  };
}

function getIndex(state) {
  return state?.repository?.snapshot?.index || null;
}

export function createAppController({
  initialState,
  repositoryHost,
  persistenceHost = null,
  taskHost = null,
  host = 'unknown',
  profilesStorageKey = 'ysp.profiles.v1',
  repositoryStorageKey = 'ysp.repository.v1'
} = {}) {
  let state = initialState ? cloneAppState(initialState) : createAppState();
  state.session.host = host || state.session.host;
  const listeners = new Set();

  function notify(event) {
    for (const listener of listeners) {
      listener(event, controller);
    }
  }

  function replaceState(nextState, event) {
    state = cloneAppState(nextState);
    notify(event);
    return state;
  }

  function getState() {
    return cloneAppState(state);
  }

  function getViewModel() {
    const treeView = selectTreeView(state);
    const folderStats = selectFolderSelectionStats(state);
    const tally = selectSelectionTally(state);

    return {
      treeView,
      folderStats,
      tally,
      combineEnabled: getCombineEligibility(state),
      profiles: state.profile.savedProfiles,
      activeProfileId: state.profile.activeProfileId,
      output: state.output,
      scanStatus: state.repository.scanStatus,
      diagnostics: state.diagnostics,
      ui: state.ui
    };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function supportsNativeRepositoryRestorePersistence() {
    return (
      Boolean(repositoryHost) &&
      typeof repositoryHost.canPersistRepositoryHandle === 'function' &&
      repositoryHost.canPersistRepositoryHandle() === true &&
      typeof repositoryHost.persistRepositoryHandle === 'function' &&
      typeof repositoryHost.hasPersistedRepositoryHandle === 'function' &&
      typeof repositoryHost.loadPersistedRepositoryHandle === 'function' &&
      typeof repositoryHost.clearPersistedRepositoryHandle === 'function'
    );
  }

  function supportsSerializedRepositoryRestorePersistence() {
    return (
      Boolean(persistenceHost) &&
      Boolean(repositoryHost) &&
      typeof repositoryHost.canSerializeRepositoryHandle === 'function' &&
      repositoryHost.canSerializeRepositoryHandle() === true &&
      typeof repositoryHost.serializeRepositoryHandle === 'function'
    );
  }

  function supportsSavedRepositoryRestore() {
    return (
      supportsNativeRepositoryRestorePersistence() ||
      supportsSerializedRepositoryRestorePersistence()
    );
  }

  async function hasSavedRepository() {
    if (supportsNativeRepositoryRestorePersistence()) {
      return repositoryHost.hasPersistedRepositoryHandle();
    }

    if (supportsSerializedRepositoryRestorePersistence()) {
      const stored = await persistenceHost.getItem(repositoryStorageKey);
      return Boolean(stored);
    }

    return false;
  }

  async function rememberCurrentRepository() {
    const repositoryHandle = state.session.repositoryHandle;

    if (supportsNativeRepositoryRestorePersistence()) {
      if (!repositoryHandle) {
        await repositoryHost.clearPersistedRepositoryHandle();
        return { saved: false, reason: 'missing-handle' };
      }

      const persisted = await repositoryHost.persistRepositoryHandle(repositoryHandle);
      if (!persisted) {
        await repositoryHost.clearPersistedRepositoryHandle();
        return { saved: false, reason: 'unserializable' };
      }

      notify({
        type: 'repository-remembered',
        payload: {
          rootName: state.repository.snapshot?.rootName || ''
        }
      });
      return { saved: true, reason: 'stored' };
    }

    if (supportsSerializedRepositoryRestorePersistence()) {
      if (!repositoryHandle) {
        await persistenceHost.removeItem(repositoryStorageKey);
        return { saved: false, reason: 'missing-handle' };
      }

      const serialized = await repositoryHost.serializeRepositoryHandle(repositoryHandle);
      if (!serialized) {
        await persistenceHost.removeItem(repositoryStorageKey);
        return { saved: false, reason: 'unserializable' };
      }

      await persistenceHost.setItem(repositoryStorageKey, serialized);
      notify({
        type: 'repository-remembered',
        payload: {
          rootName: state.repository.snapshot?.rootName || ''
        }
      });
      return { saved: true, reason: 'stored' };
    }

    return { saved: false, reason: 'unsupported' };
  }

  async function restoreSavedRepository(options = {}) {
    let persistedHandle = null;

    if (supportsNativeRepositoryRestorePersistence()) {
      persistedHandle = await repositoryHost.loadPersistedRepositoryHandle();
      if (!persistedHandle) {
        return { restored: false, reason: 'missing' };
      }
    } else if (supportsSerializedRepositoryRestorePersistence()) {
      persistedHandle = await persistenceHost.getItem(repositoryStorageKey);
      if (!persistedHandle) {
        return { restored: false, reason: 'missing' };
      }
    } else {
      return { restored: false, reason: 'unsupported' };
    }

    const restoredHandle = await repositoryHost.restoreRepository(persistedHandle, options);
    if (!restoredHandle) {
      return { restored: false, reason: 'not-granted' };
    }

    const result = await scanRepositoryHandle(restoredHandle);
    await rememberCurrentRepository();

    notify({
      type: 'repository-restored',
      payload: {
        rootName: result.result.snapshot.rootName
      }
    });

    return {
      restored: true,
      reason: 'restored',
      result
    };
  }

  async function scanRepositoryHandle(rootHandle) {
    const result = await scanSelectedRepository({
      state,
      repositoryHost,
      rootHandle,
      host,
      onProgress(payload) {
        state = cloneAppState(state);
        state.repository.scanStatus = {
          phase: payload.phase,
          progress: payload,
          unreadableEntries: state.repository.scanStatus.unreadableEntries
        };
        notify({ type: 'scan-progress', payload });
      }
    });

    replaceState(result.nextState, {
      type: 'repository-scanned',
      payload: {
        rootName: result.result.snapshot.rootName
      }
    });

    return result;
  }

  async function selectRepository() {
    const result = await selectRepositoryUseCase({
      state,
      repositoryHost,
      host,
      onProgress(payload) {
        state = cloneAppState(state);
        state.repository.scanStatus = {
          phase: payload.phase,
          progress: payload,
          unreadableEntries: state.repository.scanStatus.unreadableEntries
        };
        notify({ type: 'scan-progress', payload });
      }
    });

    replaceState(result.nextState, {
      type: 'repository-selected',
      payload: {
        rootName: result.result.snapshot.rootName
      }
    });

    return result;
  }

  async function refreshRepository() {
    const result = await refreshRepositoryUseCase({
      state,
      repositoryHost,
      onProgress(payload) {
        state = cloneAppState(state);
        state.repository.scanStatus = {
          phase: payload.phase,
          progress: payload,
          unreadableEntries: state.repository.scanStatus.unreadableEntries
        };
        notify({ type: 'scan-progress', payload });
      }
    });

    replaceState(result.nextState, {
      type: 'repository-refreshed',
      payload: {
        rootName: result.result.snapshot.rootName
      }
    });

    return result;
  }

  function setFilterQuery(query) {
    const nextState = cloneAppState(state);
    nextState.filter.query = typeof query === 'string' ? query : '';
    replaceState(nextState, {
      type: 'filter-updated',
      payload: { query: nextState.filter.query }
    });
    return getViewModel();
  }

  function setTransformOptions(partial = {}) {
    const nextState = cloneAppState(state);
    nextState.options.transforms = {
      ...nextState.options.transforms,
      ...partial
    };
    replaceState(nextState, {
      type: 'transform-options-updated',
      payload: { transforms: { ...nextState.options.transforms } }
    });
    return getViewModel();
  }

  function setPromptOptions(partial = {}) {
    const nextState = cloneAppState(state);
    nextState.options = {
      ...nextState.options,
      ...partial,
      transforms: {
        ...nextState.options.transforms
      }
    };
    replaceState(nextState, {
      type: 'prompt-options-updated',
      payload: partial
    });
    return getViewModel();
  }

  async function loadProfiles() {
    if (!persistenceHost) {
      return getViewModel();
    }

    const storedProfiles = await persistenceHost.getItem(profilesStorageKey);
    const nextState = cloneAppState(state);
    nextState.profile.savedProfiles = normalizeProfiles(storedProfiles);
    replaceState(nextState, {
      type: 'profiles-loaded',
      payload: { count: nextState.profile.savedProfiles.length }
    });
    return getViewModel();
  }

  async function persistProfiles(nextProfiles) {
    if (!persistenceHost) {
      return;
    }
    await persistenceHost.setItem(profilesStorageKey, nextProfiles);
  }

  async function saveProfile(name) {
    if (!state.repository.snapshot) {
      throw new Error('Load a repository before saving a profile');
    }

    const snapshot = createProfileSnapshot({
      name,
      state,
      repositorySnapshot: state.repository.snapshot
    });
    const nextProfiles = upsertProfile(state.profile.savedProfiles, snapshot);
    const nextState = cloneAppState(state);
    nextState.profile.savedProfiles = nextProfiles;
    nextState.profile.activeProfileId = snapshot.id;
    await persistProfiles(nextProfiles);
    replaceState(nextState, {
      type: 'profile-saved',
      payload: { id: snapshot.id, name: snapshot.name }
    });
    return snapshot;
  }

  async function loadProfile(profileId) {
    const index = getIndex(state);
    const profile = findProfileById(state.profile.savedProfiles, profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }
    if (!index) {
      throw new Error('Load a repository before applying a profile');
    }

    const applied = applyProfileToState({
      profile,
      state: cloneAppState(state),
      repositoryIndex: index
    });

    replaceState(applied.nextState, {
      type: 'profile-loaded',
      payload: {
        id: profile.id,
        name: profile.name,
        missingPaths: applied.missingPaths
      }
    });

    return applied;
  }

  async function deleteProfile(profileId) {
    const existing = findProfileById(state.profile.savedProfiles, profileId);
    if (!existing) {
      throw new Error('Profile not found');
    }

    const nextProfiles = removeProfile(state.profile.savedProfiles, profileId);
    const nextState = cloneAppState(state);
    nextState.profile.savedProfiles = nextProfiles;
    if (nextState.profile.activeProfileId === profileId) {
      nextState.profile.activeProfileId = null;
    }
    await persistProfiles(nextProfiles);
    replaceState(nextState, {
      type: 'profile-deleted',
      payload: { id: profileId, name: existing.name }
    });
    return existing;
  }

  function toggleFolderExpansion(path) {
    const nextState = cloneAppState(state);
    if (nextState.ui.expandedFolders.has(path)) {
      nextState.ui.expandedFolders.delete(path);
    } else {
      nextState.ui.expandedFolders.add(path);
    }
    replaceState(nextState, {
      type: 'folder-expansion-toggled',
      payload: { path, expanded: nextState.ui.expandedFolders.has(path) }
    });
    return getViewModel();
  }

  function setFileSelection(path, shouldSelect, options = {}) {
    const index = getIndex(state);
    if (!index || !index.textFilesByPath.has(path)) {
      return getViewModel();
    }

    const folderStats = selectFolderSelectionStats(state);
    const result = applySelectionChange({
      state: createSelectionState(state.selection),
      paths: [path],
      shouldSelect,
      fileRecordsByPath: index.textFilesByPath,
      ancestorsByFilePath: index.ancestorsByPath,
      filterVisibleFilePaths: folderStats.filterVisibleFilePaths,
      options
    });

    const nextState = cloneAppState(state);
    nextState.selection = sanitizeSelectionState(result.nextState);
    replaceState(nextState, {
      type: 'file-selection-updated',
      payload: { path, selected: shouldSelect }
    });

    return getViewModel();
  }

  function clearSelection() {
    const nextState = cloneAppState(state);
    nextState.selection.selectedPaths.clear();
    nextState.selection.filterSelectedPaths.clear();
    replaceState(nextState, { type: 'selection-cleared', payload: {} });
    return getViewModel();
  }

  function toggleAllVisibleTextFiles() {
    const index = getIndex(state);
    if (!index) {
      return getViewModel();
    }

    const folderStats = selectFolderSelectionStats(state);
    const targetPaths = state.filter.query
      ? Array.from(folderStats.filterVisibleFilePaths)
      : Array.from(index.textFilesByPath.keys());
    const allChecked =
      targetPaths.length > 0 && targetPaths.every((path) => state.selection.selectedPaths.has(path));

    const result = applySelectionChange({
      state: createSelectionState(state.selection),
      paths: targetPaths,
      shouldSelect: !allChecked,
      fileRecordsByPath: index.textFilesByPath,
      ancestorsByFilePath: index.ancestorsByPath,
      filterVisibleFilePaths: folderStats.filterVisibleFilePaths
    });

    const nextState = cloneAppState(state);
    nextState.selection = sanitizeSelectionState(result.nextState);
    replaceState(nextState, {
      type: 'visible-text-selection-toggled',
      payload: { selected: !allChecked, count: targetPaths.length }
    });

    return getViewModel();
  }

  function setFolderSelection(path, shouldSelect, options = {}) {
    const index = getIndex(state);
    if (!index) {
      return getViewModel();
    }

    const entry = getRepositoryEntry(index, path);
    if (!entry || entry.kind !== 'directory') {
      return getViewModel();
    }

    const folderStats = selectFolderSelectionStats(state);
    const descendantTextPaths = Array.from(index.childPathsByDirectory.get(path) || [])
      .filter((childPath) => index.textFilesByPath.has(childPath))
      .filter((childPath) => folderStats.filterVisibleFilePaths.has(childPath));

    const result = applySelectionChange({
      state: createSelectionState(state.selection),
      paths: descendantTextPaths,
      shouldSelect,
      fileRecordsByPath: index.textFilesByPath,
      ancestorsByFilePath: index.ancestorsByPath,
      filterVisibleFilePaths: folderStats.filterVisibleFilePaths,
      options
    });

    const nextState = cloneAppState(state);
    nextState.selection = sanitizeSelectionState(result.nextState);
    replaceState(nextState, {
      type: 'folder-selection-updated',
      payload: { path, selected: shouldSelect, count: descendantTextPaths.length }
    });

    return getViewModel();
  }

  async function combineSelection() {
    const result = await combineSelectionUseCase({
      state,
      repositoryHost,
      taskHost
    });

    replaceState(result.nextState, {
      type: 'selection-combined',
      payload: {
        fileCount: result.bundle.files.length,
        transformExecution: result.transformExecution
      }
    });

    return result;
  }

  function getFolderCheckboxState(path) {
    return selectFolderCheckboxState(state, path);
  }

  function normalizeError(error, context) {
    return normalizeUseCaseError(error, context);
  }

  const controller = {
    getState,
    getViewModel,
    subscribe,
    supportsSavedRepositoryRestore,
    hasSavedRepository,
    rememberCurrentRepository,
    restoreSavedRepository,
    selectRepository,
    scanRepositoryHandle,
    refreshRepository,
    loadProfiles,
    saveProfile,
    loadProfile,
    deleteProfile,
    setFilterQuery,
    setTransformOptions,
    setPromptOptions,
    toggleFolderExpansion,
    setFileSelection,
    setFolderSelection,
    toggleAllVisibleTextFiles,
    clearSelection,
    combineSelection,
    getFolderCheckboxState,
    normalizeError
  };

  return controller;
}
