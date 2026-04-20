import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasResolvableElectronBridgeSource,
  resolveElectronBridgeSource
} from '../../apps/electron/src/bridge.js';
import { bootElectronEntry } from '../../apps/electron/src/entry.js';

function createWindowWithBridge() {
  return {
    __YSP_ELECTRON__: {
      async invoke() {
        return null;
      }
    }
  };
}

test('resolveElectronBridgeSource recognizes the exposed preload bridge', () => {
  const windowObject = createWindowWithBridge();

  assert.equal(resolveElectronBridgeSource(windowObject), windowObject.__YSP_ELECTRON__);
  assert.equal(hasResolvableElectronBridgeSource(windowObject), true);
});

test('bootElectronEntry composes and exposes the Electron app on window', async () => {
  const windowObject = {
    __YSP_ELECTRON__: {
      async invoke(operation, payload = {}) {
        switch (operation) {
          case 'selectRepository':
            return {
              rootPath: '/repo',
              path: '',
              kind: 'directory',
              name: 'repo'
            };
          case 'listDirectory':
            return [];
          case 'getItem':
            return null;
          case 'setItem':
          case 'removeItem':
            return null;
          case 'copyText':
            return { copied: true };
          case 'saveText':
            return { mode: 'save', fileName: payload.fileName || 'combined_files.txt' };
          case 'downloadText':
            return { mode: 'download', fileName: payload.fileName || 'combined_files.txt' };
          case 'restoreRepository':
            return payload.handle || null;
          case 'readTextFile':
            return '';
          case 'readFileMetadata':
            return { size: 0 };
          case 'resolvePath':
            return null;
          case 'runTask':
            return payload.payload;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      }
    }
  };

  const app = bootElectronEntry({ windowObject });

  assert.equal(windowObject.yspElectronApp, app);
  assert.equal(app.controller.getState().session.host, 'electron');
});

test('hasResolvableElectronBridgeSource returns false when no bridge is present', () => {
  assert.equal(hasResolvableElectronBridgeSource({}), false);
  assert.throws(() => resolveElectronBridgeSource({}), /No Electron bridge was found/);
});
