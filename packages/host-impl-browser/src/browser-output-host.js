function sanitizeFileName(fileName) {
  const fallback = 'combined_files.txt';
  let name = typeof fileName === 'string' ? fileName.trim() : fallback;

  if (!name) {
    name = fallback;
  }

  name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\.+$/g, '');
  if (!name) {
    name = fallback;
  }
  if (!name.toLowerCase().endsWith('.txt')) {
    name += '.txt';
  }

  return name;
}

function triggerDownload(windowObject, content, fileName) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = windowObject.URL.createObjectURL(blob);
  const anchor = windowObject.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  windowObject.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  windowObject.URL.revokeObjectURL(url);
}

export function createBrowserOutputHost({ windowObject = globalThis.window } = {}) {
  if (!windowObject) {
    throw new TypeError('Browser OutputHost requires a window-like object');
  }

  return {
    async copyText(text) {
      return windowObject.navigator.clipboard.writeText(text);
    },

    async downloadText(text, fileName) {
      const safeName = sanitizeFileName(fileName);
      triggerDownload(windowObject, text, safeName);
      return { fileName: safeName };
    },

    async saveText(text, fileName) {
      const safeName = sanitizeFileName(fileName);

      if (typeof windowObject.showSaveFilePicker !== 'function') {
        triggerDownload(windowObject, text, safeName);
        return {
          mode: 'download',
          fileName: safeName
        };
      }

      const handle = await windowObject.showSaveFilePicker({
        suggestedName: safeName,
        types: [
          {
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();

      return {
        mode: 'save',
        fileName: handle.name || safeName
      };
    }
  };
}
