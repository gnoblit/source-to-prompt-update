import { bootBrowserUI } from './ui/boot.js';

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootBrowserUI();
    });
  } else {
    bootBrowserUI();
  }
}
