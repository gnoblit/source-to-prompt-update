import { bootShellUI } from '../../../../packages/shell-ui/src/boot.js';
import { bootTauriEntryApp } from '../entry.js';

export function bootTauriUI(options = {}) {
  return bootShellUI({
    ...options,
    bootApp: bootTauriEntryApp
  });
}
