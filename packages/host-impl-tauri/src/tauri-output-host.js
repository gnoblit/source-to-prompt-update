import { normalizeTauriBridge } from './tauri-bridge.js';

function createCancelledError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function createTauriOutputHost({ bridge } = {}) {
  const tauriBridge = normalizeTauriBridge(bridge);

  return {
    async copyText(text) {
      return tauriBridge.call('copyText', { text });
    },

    async downloadText(text, fileName) {
      if (tauriBridge.hasOperation('downloadText')) {
        const result = await tauriBridge.call('downloadText', { text, fileName });
        if (!result) {
          throw createCancelledError('Download was cancelled');
        }
        return result;
      }

      const fallback = await tauriBridge.call('saveText', { text, fileName });
      if (!fallback) {
        throw createCancelledError('Download was cancelled');
      }
      return fallback;
    },

    async saveText(text, fileName) {
      const result = await tauriBridge.call('saveText', { text, fileName });
      if (!result) {
        throw createCancelledError('Save was cancelled');
      }
      return result;
    }
  };
}
