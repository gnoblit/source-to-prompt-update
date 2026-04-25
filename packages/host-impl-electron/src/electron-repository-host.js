import { normalizeElectronBridge } from './electron-bridge.js';

function createCancelledError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    throw createCancelledError('Operation aborted');
  }
}

export function createElectronRepositoryHost({ bridge } = {}) {
  const electronBridge = normalizeElectronBridge(bridge);

  return {
    canPersistRepositoryHandle() {
      return true;
    },

    async persistRepositoryHandle(handle) {
      if (!handle || typeof handle !== 'object') {
        return false;
      }

      await electronBridge.call('setItem', {
        key: 'ysp.repository.handle.v1',
        value: handle
      });

      return true;
    },

    async hasPersistedRepositoryHandle() {
      return Boolean(
        await electronBridge.call('getItem', {
          key: 'ysp.repository.handle.v1'
        })
      );
    },

    async loadPersistedRepositoryHandle() {
      return electronBridge.call('getItem', {
        key: 'ysp.repository.handle.v1'
      });
    },

    async clearPersistedRepositoryHandle() {
      await electronBridge.call('removeItem', {
        key: 'ysp.repository.handle.v1'
      });
    },

    canSerializeRepositoryHandle() {
      return true;
    },

    async serializeRepositoryHandle(handle) {
      if (!handle || typeof handle !== 'object') {
        return null;
      }

      return JSON.parse(JSON.stringify(handle));
    },

    async selectRepository(previousHandle = null) {
      const handle = await electronBridge.call('selectRepository', { previousHandle });
      if (!handle) {
        throw createCancelledError('Repository selection was cancelled');
      }
      return handle;
    },

    async restoreRepository(handle, options = {}) {
      return electronBridge.call('restoreRepository', { handle, options });
    },

    async listDirectory(handle, options = {}) {
      throwIfAborted(options.signal);
      const result = await electronBridge.call('listDirectory', { handle });
      throwIfAborted(options.signal);
      return result;
    },

    async readTextFile(handle, options = {}) {
      throwIfAborted(options.signal);
      const result = await electronBridge.call('readTextFile', { handle });
      throwIfAborted(options.signal);
      return result;
    },

    async readFileMetadata(handle, options = {}) {
      throwIfAborted(options.signal);
      const result = await electronBridge.call('readFileMetadata', { handle });
      throwIfAborted(options.signal);
      return result;
    },

    async resolvePath(rootHandle, path, options = {}) {
      throwIfAborted(options.signal);
      const result = await electronBridge.call('resolvePath', { rootHandle, path });
      throwIfAborted(options.signal);
      return result;
    }
  };
}
