import { hasResolvableTauriBridgeSource, resolveTauriBridgeSource } from './bridge.js';
import { bootTauriApp } from './main.js';

export function bootTauriEntryApp({
  windowObject = globalThis.window,
  onDiagnosticsChange
} = {}) {
  const bridge = resolveTauriBridgeSource(windowObject);
  const app = bootTauriApp({
    bridge,
    onDiagnosticsChange
  });

  if (windowObject && typeof windowObject === 'object') {
    windowObject.yspTauriApp = app;
  }

  return app;
}

export function bootTauriEntry(options = {}) {
  return bootTauriEntryApp(options);
}

function updateBootFailureUi(windowObject, error) {
  const documentObject = windowObject?.document;
  if (!documentObject || typeof documentObject.getElementById !== 'function') {
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const statusElement = documentObject.getElementById('statusMessage');
  if (statusElement) {
    statusElement.className = 'status-message error';
    statusElement.textContent = `Tauri desktop bridge failed to initialize: ${message}`;
  }

  const diagnosticsElement = documentObject.getElementById('diagnosticsLog');
  if (diagnosticsElement) {
    diagnosticsElement.textContent = JSON.stringify(
      {
        event: 'tauri-boot-error',
        message
      },
      null,
      2
    );
  }
}

export function waitForResolvableTauriBridgeSource({
  windowObject = globalThis.window,
  timeoutMs = 3000,
  pollIntervalMs = 25
} = {}) {
  if (hasResolvableTauriBridgeSource(windowObject)) {
    return Promise.resolve(resolveTauriBridgeSource(windowObject));
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function check() {
      if (hasResolvableTauriBridgeSource(windowObject)) {
        resolve(resolveTauriBridgeSource(windowObject));
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new TypeError('No Tauri bridge was found on the window object before boot timeout'));
        return;
      }

      setTimeout(check, pollIntervalMs);
    }

    check();
  });
}

export async function bootTauriUiWhenReady({
  windowObject = globalThis.window,
  loadBootModule = () => import('./ui/boot.js'),
  timeoutMs = 3000,
  pollIntervalMs = 25
} = {}) {
  try {
    await waitForResolvableTauriBridgeSource({
      windowObject,
      timeoutMs,
      pollIntervalMs
    });
    const { bootTauriUI } = await loadBootModule();
    return bootTauriUI({ windowObject });
  } catch (error) {
    updateBootFailureUi(windowObject, error);
    throw error;
  }
}

if (typeof window !== 'undefined') {
  bootTauriUiWhenReady({ windowObject: window }).catch((error) => {
    console.error('Failed to boot Tauri UI.', error);
  });
}
