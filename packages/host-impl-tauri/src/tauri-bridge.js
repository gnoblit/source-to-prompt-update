export const DEFAULT_TAURI_COMMANDS = {
  selectRepository: 'ysp_select_repository',
  restoreRepository: 'ysp_restore_repository',
  listDirectory: 'ysp_list_directory',
  readTextFile: 'ysp_read_text_file',
  readFileMetadata: 'ysp_read_file_metadata',
  resolvePath: 'ysp_resolve_path',
  getItem: 'ysp_storage_get_item',
  setItem: 'ysp_storage_set_item',
  removeItem: 'ysp_storage_remove_item',
  copyText: 'ysp_copy_text',
  saveText: 'ysp_save_text',
  downloadText: 'ysp_download_text',
  runTask: 'ysp_run_task'
};

function normalizeInvokeSource(input) {
  if (typeof input === 'function') {
    return {
      invoke: input,
      commandMap: {}
    };
  }

  if (!input || typeof input !== 'object') {
    throw new TypeError('Tauri bridge requires an invoke function or bridge-like object');
  }

  if (typeof input.invoke !== 'function') {
    throw new TypeError('Tauri bridge requires an invoke function');
  }

  return {
    invoke: input.invoke,
    commandMap: input.commandMap || input.commands || {}
  };
}

export function createTauriBridge(input = {}) {
  const { invoke, commandMap } = normalizeInvokeSource(input);
  const commands = {
    ...DEFAULT_TAURI_COMMANDS,
    ...commandMap
  };

  return {
    invoke,
    commands,

    hasOperation(operation) {
      return typeof commands[operation] === 'string' && commands[operation].length > 0;
    },

    async call(operation, payload = {}) {
      const command = commands[operation];
      if (!command) {
        throw new Error(`No Tauri command configured for operation: ${operation}`);
      }
      return invoke(command, payload);
    },

    async callCommand(command, payload = {}) {
      if (typeof command !== 'string' || !command) {
        throw new TypeError('callCommand requires a non-empty command name');
      }
      return invoke(command, payload);
    }
  };
}

export function normalizeTauriBridge(input) {
  if (
    input &&
    typeof input === 'object' &&
    typeof input.call === 'function' &&
    typeof input.callCommand === 'function' &&
    typeof input.hasOperation === 'function'
  ) {
    return input;
  }

  return createTauriBridge(input);
}
