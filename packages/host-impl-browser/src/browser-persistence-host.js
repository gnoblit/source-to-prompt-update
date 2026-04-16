function decodeStoredValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function createBrowserPersistenceHost({ storage = globalThis.localStorage } = {}) {
  if (!storage) {
    throw new TypeError('Browser PersistenceHost requires a storage-like object');
  }

  return {
    async getItem(key) {
      return decodeStoredValue(storage.getItem(key));
    },

    async setItem(key, value) {
      const encoded = typeof value === 'string' ? value : JSON.stringify(value);
      storage.setItem(key, encoded);
    },

    async removeItem(key) {
      storage.removeItem(key);
    }
  };
}
