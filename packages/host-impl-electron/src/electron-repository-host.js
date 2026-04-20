import { normalizeElectronBridge } from './electron-bridge.js';

function createCancelledError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
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

    async listDirectory(handle) {
      return electronBridge.call('listDirectory', { handle });
    },

    async readTextFile(handle) {
      return electronBridge.call('readTextFile', { handle });
    },

    async readFileMetadata(handle) {
      return electronBridge.call('readFileMetadata', { handle });
    },

    async resolvePath(rootHandle, path) {
      return electronBridge.call('resolvePath', { rootHandle, path });
    }
  };
}
