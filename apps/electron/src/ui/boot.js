import { bootShellUI } from '../../../../packages/shell-ui/src/boot.js';
import { bootElectronEntryApp } from '../entry.js';

export function bootElectronUI(options = {}) {
  return bootShellUI({
    ...options,
    bootApp: bootElectronEntryApp
  });
}
