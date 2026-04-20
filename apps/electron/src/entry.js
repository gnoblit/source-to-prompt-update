import { hasResolvableElectronBridgeSource, resolveElectronBridgeSource } from './bridge.js';
import { bootElectronApp } from './main.js';
import { bootShellUI } from '../../../packages/shell-ui/src/boot.js';

export function bootElectronEntryApp({
  windowObject = globalThis.window,
  onDiagnosticsChange
} = {}) {
  const bridge = resolveElectronBridgeSource(windowObject);
  const app = bootElectronApp({
    bridge,
    onDiagnosticsChange
  });

  if (windowObject && typeof windowObject === 'object') {
    windowObject.yspElectronApp = app;
  }

  return app;
}

function updateBootFailureUi(windowObject, error) {
  const documentObject = windowObject?.document;
  if (!documentObject || typeof documentObject.getElementById !== 'function') {
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const statusElement = documentObject.getElementById('statusMessage');
  const diagnosticsElement = documentObject.getElementById('diagnosticsLog');

  if (statusElement) {
    statusElement.className = 'status-message error';
    statusElement.textContent = `Electron desktop bridge failed to initialize: ${message}`;
  }

  if (diagnosticsElement) {
    diagnosticsElement.textContent = JSON.stringify(
      {
        event: 'electron-boot-error',
        message
      },
      null,
      2
    );
  }
}

export function bootElectronEntry(options = {}) {
  return bootElectronEntryApp(options);
}

if (typeof window !== 'undefined') {
  try {
    if (!hasResolvableElectronBridgeSource(window)) {
      throw new TypeError('No Electron bridge was found on the window object');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        bootShellUI({
          windowObject: window,
          bootApp: bootElectronEntryApp
        });
      });
    } else {
      bootShellUI({
        windowObject: window,
        bootApp: bootElectronEntryApp
      });
    }
  } catch (error) {
    updateBootFailureUi(window, error);
    console.error('Failed to boot Electron UI.', error);
  }
}
