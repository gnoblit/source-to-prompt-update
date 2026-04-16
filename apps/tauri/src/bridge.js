export function resolveTauriBridgeSource(windowObject = globalThis.window) {
  if (!windowObject || typeof windowObject !== 'object') {
    throw new TypeError('Tauri bridge resolution requires a window-like object');
  }

  if (
    windowObject.__YSP_TAURI_BRIDGE__ &&
    typeof windowObject.__YSP_TAURI_BRIDGE__.invoke === 'function'
  ) {
    return windowObject.__YSP_TAURI_BRIDGE__;
  }

  if (windowObject.__TAURI__?.core && typeof windowObject.__TAURI__.core.invoke === 'function') {
    return {
      invoke: windowObject.__TAURI__.core.invoke
    };
  }

  if (typeof windowObject.__TAURI_INVOKE__ === 'function') {
    return {
      invoke: windowObject.__TAURI_INVOKE__
    };
  }

  throw new TypeError('No Tauri bridge was found on the window object');
}

export function hasResolvableTauriBridgeSource(windowObject = globalThis.window) {
  try {
    resolveTauriBridgeSource(windowObject);
    return true;
  } catch {
    return false;
  }
}
