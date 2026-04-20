import { normalizeElectronBridge } from './electron-bridge.js';

export function createElectronPersistenceHost({ bridge } = {}) {
  const electronBridge = normalizeElectronBridge(bridge);

  return {
    async getItem(key) {
      return electronBridge.call('getItem', { key });
    },

    async setItem(key, value) {
      await electronBridge.call('setItem', { key, value });
    },

    async removeItem(key) {
      await electronBridge.call('removeItem', { key });
    }
  };
}
