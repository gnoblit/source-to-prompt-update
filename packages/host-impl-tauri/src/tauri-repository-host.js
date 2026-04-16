import { normalizeTauriBridge } from './tauri-bridge.js';

function createCancelledError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function createTauriRepositoryHost({ bridge } = {}) {
  const tauriBridge = normalizeTauriBridge(bridge);

  return {
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
      const handle = await tauriBridge.call('selectRepository', { previousHandle });
      if (!handle) {
        throw createCancelledError('Repository selection was cancelled');
      }
      return handle;
    },

    async restoreRepository(handle, options = {}) {
      return tauriBridge.call('restoreRepository', { handle, options });
    },

    async listDirectory(handle) {
      return tauriBridge.call('listDirectory', { handle });
    },

    async readTextFile(handle) {
      return tauriBridge.call('readTextFile', { handle });
    },

    async readFileMetadata(handle) {
      return tauriBridge.call('readFileMetadata', { handle });
    },

    async resolvePath(rootHandle, path) {
      return tauriBridge.call('resolvePath', { rootHandle, path });
    }
  };
}
