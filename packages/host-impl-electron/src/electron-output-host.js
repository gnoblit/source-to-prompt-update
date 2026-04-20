import { normalizeElectronBridge } from './electron-bridge.js';

function createCancelledError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function createElectronOutputHost({ bridge } = {}) {
  const electronBridge = normalizeElectronBridge(bridge);

  return {
    async copyText(text) {
      return electronBridge.call('copyText', { text });
    },

    async downloadText(text, fileName) {
      if (electronBridge.hasOperation('downloadText')) {
        const result = await electronBridge.call('downloadText', { text, fileName });
        if (!result) {
          throw createCancelledError('Download was cancelled');
        }
        return result;
      }

      const fallback = await electronBridge.call('saveText', { text, fileName });
      if (!fallback) {
        throw createCancelledError('Download was cancelled');
      }
      return fallback;
    },

    async saveText(text, fileName) {
      const result = await electronBridge.call('saveText', { text, fileName });
      if (!result) {
        throw createCancelledError('Save was cancelled');
      }
      return result;
    }
  };
}
