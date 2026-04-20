export function resolveElectronBridgeSource(windowObject = globalThis.window) {
  if (!windowObject || typeof windowObject !== 'object') {
    throw new TypeError('Electron bridge resolution requires a window-like object');
  }

  if (
    windowObject.__YSP_ELECTRON__ &&
    typeof windowObject.__YSP_ELECTRON__.invoke === 'function'
  ) {
    return windowObject.__YSP_ELECTRON__;
  }

  throw new TypeError('No Electron bridge was found on the window object');
}

export function hasResolvableElectronBridgeSource(windowObject = globalThis.window) {
  try {
    resolveElectronBridgeSource(windowObject);
    return true;
  } catch {
    return false;
  }
}
