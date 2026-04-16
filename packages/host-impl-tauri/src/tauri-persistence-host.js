import { normalizeTauriBridge } from './tauri-bridge.js';

export function createTauriPersistenceHost({ bridge } = {}) {
  const tauriBridge = normalizeTauriBridge(bridge);

  return {
    async getItem(key) {
      return tauriBridge.call('getItem', { key });
    },

    async setItem(key, value) {
      await tauriBridge.call('setItem', { key, value });
    },

    async removeItem(key) {
      await tauriBridge.call('removeItem', { key });
    }
  };
}
