const { app, BrowserWindow, clipboard, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const scriptDirectory = __dirname;
const appDirectory = path.resolve(scriptDirectory, '..');
const indexFilePath = path.resolve(appDirectory, 'index.html');
let mainWindow = null;

// Some Linux environments fail Chromium GPU initialization on startup.
// Falling back to software rendering keeps the renderer interactive.
app.disableHardwareAcceleration();

function fileNameForPath(targetPath) {
  const value = path.basename(targetPath);
  return value || targetPath;
}

function toHandlePath(relativePath) {
  return String(relativePath || '').split(path.sep).join('/');
}

async function normalizeRootPath(rootPath) {
  if (typeof rootPath !== 'string' || !rootPath) {
    throw new Error('Repository root path is required');
  }

  const realPath = await fs.realpath(rootPath);
  const stats = await fs.stat(realPath);
  if (!stats.isDirectory()) {
    throw new Error(`Repository root is not a directory: ${rootPath}`);
  }

  return realPath;
}

function validateRelativePath(relativePath) {
  const rawPath = typeof relativePath === 'string' ? relativePath : '';
  const normalized = path.posix.normalize(rawPath.replace(/\\/g, '/'));

  if (
    normalized.startsWith('../') ||
    normalized === '..' ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    throw new Error(`Invalid repository-relative path: ${relativePath}`);
  }

  return normalized === '.' ? '' : normalized;
}

async function createDirectoryHandle(rootPath, relativePath = '', kind = 'directory') {
  const root = await normalizeRootPath(rootPath);
  const normalizedRelativePath = validateRelativePath(relativePath);
  const absolutePath = normalizedRelativePath ? path.join(root, normalizedRelativePath) : root;

  return {
    rootPath: root,
    path: normalizedRelativePath,
    kind,
    name: normalizedRelativePath ? fileNameForPath(absolutePath) : fileNameForPath(root)
  };
}

async function absolutePathForHandle(handle) {
  if (!handle || typeof handle !== 'object') {
    throw new Error('A valid filesystem handle is required');
  }

  const root = await normalizeRootPath(handle.rootPath);
  const normalizedRelativePath = validateRelativePath(handle.path);
  const absolutePath = normalizedRelativePath ? path.join(root, normalizedRelativePath) : root;
  const normalizedAbsolutePath = path.normalize(absolutePath);
  const relativeToRoot = path.relative(root, normalizedAbsolutePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Resolved path escapes repository root: ${handle.path}`);
  }

  return {
    root,
    absolutePath: normalizedAbsolutePath
  };
}

function sanitizeFileName(input) {
  const fallback = 'combined_files.txt';
  const trimmed = typeof input === 'string' ? input.trim() : fallback;
  const base = trimmed || fallback;
  let sanitized = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.+$/g, '')
    .trim();

  if (!sanitized) {
    sanitized = fallback;
  }

  if (!sanitized.toLowerCase().endsWith('.txt')) {
    sanitized += '.txt';
  }

  return sanitized;
}

async function getStorageFilePath() {
  const directory = app.getPath('userData');
  await fs.mkdir(directory, { recursive: true });
  return path.join(directory, 'storage.json');
}

async function readStorageMap() {
  const storageFilePath = await getStorageFilePath();

  try {
    const raw = await fs.readFile(storageFilePath, 'utf8');
    if (!raw.trim()) {
      return {};
    }

    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function writeStorageMap(storageMap) {
  const storageFilePath = await getStorageFilePath();
  await fs.writeFile(storageFilePath, JSON.stringify(storageMap, null, 2));
}

async function saveTextToPath(targetPath, text) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, text, 'utf8');
}

async function handleInvoke(event, operation, payload = {}) {
  switch (operation) {
    case 'selectRepository': {
      const window = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const result = await dialog.showOpenDialog(window, {
        title: 'Select Repository',
        properties: ['openDirectory']
      });

      if (result.canceled || !result.filePaths[0]) {
        return null;
      }

      return createDirectoryHandle(result.filePaths[0]);
    }

    case 'restoreRepository': {
      if (!payload.handle) {
        return null;
      }

      try {
        return await createDirectoryHandle(
          payload.handle.rootPath,
          payload.handle.path,
          payload.handle.kind
        );
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          return null;
        }

        throw error;
      }
    }

    case 'listDirectory': {
      const { root, absolutePath } = await absolutePathForHandle(payload.handle);
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });

      return entries
        .map((entry) => {
          const childAbsolutePath = path.join(absolutePath, entry.name);
          const relativePath = toHandlePath(path.relative(root, childAbsolutePath));
          const kind = entry.isDirectory() ? 'directory' : 'file';

          return {
            name: entry.name,
            kind,
            handle: {
              rootPath: root,
              path: relativePath,
              kind,
              name: entry.name
            }
          };
        })
        .sort((left, right) => {
          if (left.kind !== right.kind) {
            return left.kind === 'directory' ? -1 : 1;
          }

          return left.name.localeCompare(right.name);
        });
    }

    case 'readTextFile': {
      const { absolutePath } = await absolutePathForHandle(payload.handle);
      return fs.readFile(absolutePath, 'utf8');
    }

    case 'readFileMetadata': {
      const { absolutePath } = await absolutePathForHandle(payload.handle);
      const stats = await fs.stat(absolutePath);
      const extension = path.extname(absolutePath).replace(/^\./, '') || null;

      return {
        size: stats.size,
        lastModified: Number.isFinite(stats.mtimeMs) ? Math.floor(stats.mtimeMs) : null,
        fileType: extension
      };
    }

    case 'resolvePath': {
      const root = await normalizeRootPath(payload.rootHandle.rootPath);
      const relativePath = validateRelativePath(payload.path);
      const absolutePath = relativePath ? path.join(root, relativePath) : root;
      const stats = await fs.stat(absolutePath);

      return {
        rootPath: root,
        path: relativePath,
        kind: stats.isDirectory() ? 'directory' : 'file',
        name: fileNameForPath(absolutePath)
      };
    }

    case 'getItem': {
      const storageMap = await readStorageMap();
      return Object.prototype.hasOwnProperty.call(storageMap, payload.key)
        ? storageMap[payload.key]
        : null;
    }

    case 'setItem': {
      const storageMap = await readStorageMap();
      storageMap[payload.key] = payload.value;
      await writeStorageMap(storageMap);
      return null;
    }

    case 'removeItem': {
      const storageMap = await readStorageMap();
      delete storageMap[payload.key];
      await writeStorageMap(storageMap);
      return null;
    }

    case 'copyText':
      clipboard.writeText(String(payload.text || ''));
      return { copied: true };

    case 'saveText': {
      const window = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const suggestedName = sanitizeFileName(payload.fileName);
      const result = await dialog.showSaveDialog(window, {
        title: 'Save Prompt Bundle',
        defaultPath: suggestedName,
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      await saveTextToPath(result.filePath, String(payload.text || ''));
      return {
        mode: 'save',
        fileName: fileNameForPath(result.filePath)
      };
    }

    case 'downloadText': {
      const suggestedName = sanitizeFileName(payload.fileName);
      const downloadsDirectory = app.getPath('downloads');
      const downloadPath = path.join(downloadsDirectory, suggestedName);

      await saveTextToPath(downloadPath, String(payload.text || ''));
      return {
        mode: 'download',
        fileName: fileNameForPath(downloadPath)
      };
    }

    case 'runTask':
      return payload.payload;

    default:
      throw new Error(`Unknown Electron operation: ${operation}`);
  }
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(scriptDirectory, 'preload.cjs')
    }
  });

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
  });

  window.loadFile(indexFilePath);
  return window;
}

app.whenReady().then(() => {
  ipcMain.handle('ysp:invoke', handleInvoke);
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
