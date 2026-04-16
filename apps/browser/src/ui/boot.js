import { bootShellUI } from '../../../../packages/shell-ui/src/boot.js';
import { bootBrowserApp } from '../main.js';

export function bootBrowserUI(options = {}) {
  return bootShellUI({
    ...options,
    bootApp: bootBrowserApp
  });
}
