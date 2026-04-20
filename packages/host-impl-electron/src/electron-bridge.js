export const DEFAULT_ELECTRON_OPERATIONS = {
  selectRepository: 'selectRepository',
  restoreRepository: 'restoreRepository',
  listDirectory: 'listDirectory',
  readTextFile: 'readTextFile',
  readFileMetadata: 'readFileMetadata',
  resolvePath: 'resolvePath',
  getItem: 'getItem',
  setItem: 'setItem',
  removeItem: 'removeItem',
  copyText: 'copyText',
  saveText: 'saveText',
  downloadText: 'downloadText',
  runTask: 'runTask'
};

function normalizeInvokeSource(input) {
  if (typeof input === 'function') {
    return {
      invoke: input,
      operationMap: {}
    };
  }

  if (!input || typeof input !== 'object') {
    throw new TypeError('Electron bridge requires an invoke function or bridge-like object');
  }

  if (typeof input.invoke !== 'function') {
    throw new TypeError('Electron bridge requires an invoke function');
  }

  return {
    invoke: input.invoke,
    operationMap: input.operationMap || input.operations || {}
  };
}

export function createElectronBridge(input = {}) {
  const { invoke, operationMap } = normalizeInvokeSource(input);
  const operations = {
    ...DEFAULT_ELECTRON_OPERATIONS,
    ...operationMap
  };

  return {
    invoke,
    operations,

    hasOperation(operation) {
      return typeof operations[operation] === 'string' && operations[operation].length > 0;
    },

    async call(operation, payload = {}) {
      const mappedOperation = operations[operation];
      if (!mappedOperation) {
        throw new Error(`No Electron operation configured for: ${operation}`);
      }

      return invoke(mappedOperation, payload);
    },

    async callOperation(operation, payload = {}) {
      if (typeof operation !== 'string' || !operation) {
        throw new TypeError('callOperation requires a non-empty operation name');
      }

      return invoke(operation, payload);
    }
  };
}

export function normalizeElectronBridge(input) {
  if (
    input &&
    typeof input === 'object' &&
    typeof input.call === 'function' &&
    typeof input.callOperation === 'function' &&
    typeof input.hasOperation === 'function'
  ) {
    return input;
  }

  return createElectronBridge(input);
}
