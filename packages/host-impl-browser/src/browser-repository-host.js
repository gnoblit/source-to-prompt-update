function isLikelyProtectedFolderError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = typeof error.name === 'string' ? error.name : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';

  if (!['AbortError', 'NotAllowedError', 'SecurityError'].includes(name)) {
    return false;
  }

  return (
    message.includes('system') ||
    message.includes('protected') ||
    message.includes('not allowed') ||
    message.includes('security') ||
    message.includes('permission')
  );
}

function createRequestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function createIndexedDbRepositoryHandleStore({
  indexedDBObject = globalThis.indexedDB,
  databaseName = 'ysp-browser-host',
  objectStoreName = 'repositoryHandles'
} = {}) {
  if (!indexedDBObject || typeof indexedDBObject.open !== 'function') {
    return null;
  }

  async function openDatabase() {
    const request = indexedDBObject.open(databaseName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(objectStoreName)) {
        database.createObjectStore(objectStoreName);
      }
    };

    return createRequestPromise(request);
  }

  async function withStore(mode, callback) {
    const database = await openDatabase();

    try {
      const transaction = database.transaction(objectStoreName, mode);
      const store = transaction.objectStore(objectStoreName);
      const result = await callback(store);

      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error || new Error('IndexedDB transaction failed'));
        transaction.onabort = () =>
          reject(transaction.error || new Error('IndexedDB transaction aborted'));
      });

      return result;
    } finally {
      database.close();
    }
  }

  return {
    async get(key) {
      return withStore('readonly', (store) => createRequestPromise(store.get(key)));
    },

    async set(key, value) {
      return withStore('readwrite', (store) => createRequestPromise(store.put(value, key)));
    },

    async remove(key) {
      return withStore('readwrite', (store) => createRequestPromise(store.delete(key)));
    },

    async has(key) {
      if (typeof IDBObjectStore !== 'undefined' && 'getKey' in IDBObjectStore.prototype) {
        return withStore('readonly', async (store) => {
          const value = await createRequestPromise(store.getKey(key));
          return value !== undefined;
        });
      }

      return withStore('readonly', async (store) => {
        const value = await createRequestPromise(store.get(key));
        return value !== undefined;
      });
    }
  };
}

async function pickDirectoryHandleWithFallback(windowObject, previousHandle) {
  const preferredOptions = {
    id: 'your-source-to-prompt-folder',
    mode: 'read',
    startIn: previousHandle || 'documents'
  };

  try {
    return await windowObject.showDirectoryPicker(preferredOptions);
  } catch (firstError) {
    if (!isLikelyProtectedFolderError(firstError)) {
      throw firstError;
    }

    return windowObject.showDirectoryPicker({ mode: 'read' });
  }
}

export function createBrowserRepositoryHost({
  windowObject = globalThis.window,
  repositoryHandleStore = createIndexedDbRepositoryHandleStore()
} = {}) {
  if (!windowObject) {
    throw new TypeError('Browser RepositoryHost requires a window-like object');
  }

  const repositoryHandleKey = 'lastRepositoryHandle';

  return {
    canPersistRepositoryHandle() {
      return Boolean(repositoryHandleStore);
    },

    async persistRepositoryHandle(handle) {
      if (!repositoryHandleStore || !handle) {
        return false;
      }

      await repositoryHandleStore.set(repositoryHandleKey, handle);
      return true;
    },

    async hasPersistedRepositoryHandle() {
      if (!repositoryHandleStore) {
        return false;
      }

      return repositoryHandleStore.has(repositoryHandleKey);
    },

    async loadPersistedRepositoryHandle() {
      if (!repositoryHandleStore) {
        return null;
      }

      return repositoryHandleStore.get(repositoryHandleKey);
    },

    async clearPersistedRepositoryHandle() {
      if (!repositoryHandleStore) {
        return;
      }

      await repositoryHandleStore.remove(repositoryHandleKey);
    },

    canSerializeRepositoryHandle() {
      return false;
    },

    async serializeRepositoryHandle() {
      return null;
    },

    async selectRepository(previousHandle = null) {
      if (typeof windowObject.showDirectoryPicker !== 'function') {
        const error = new TypeError('showDirectoryPicker is not available');
        error.name = 'TypeError';
        throw error;
      }

      return pickDirectoryHandleWithFallback(windowObject, previousHandle);
    },

    async restoreRepository(handle, options = {}) {
      if (!handle || typeof handle.queryPermission !== 'function') {
        return null;
      }

      let permission = await handle.queryPermission({ mode: 'read' });
      if (
        permission === 'prompt' &&
        options.allowPrompt === true &&
        typeof handle.requestPermission === 'function'
      ) {
        permission = await handle.requestPermission({ mode: 'read' });
      }

      return permission === 'granted' ? handle : null;
    },

    async listDirectory(handle) {
      const entries = [];
      for await (const entry of handle.values()) {
        entries.push({
          name: entry.name,
          kind: entry.kind,
          handle: entry
        });
      }
      return entries;
    },

    async readTextFile(handle) {
      const file = await handle.getFile();
      return file.text();
    },

    async readFileMetadata(handle) {
      const file = await handle.getFile();
      return {
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };
    },

    async resolvePath(rootHandle, path) {
      const parts = String(path)
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean);

      if (parts.length === 0) {
        return rootHandle;
      }

      let current = rootHandle;
      for (let index = 0; index < parts.length; index += 1) {
        const segment = parts[index];
        const isLast = index === parts.length - 1;

        if (isLast) {
          try {
            return await current.getFileHandle(segment);
          } catch {
            return current.getDirectoryHandle(segment);
          }
        }

        current = await current.getDirectoryHandle(segment);
      }

      return current;
    }
  };
}
