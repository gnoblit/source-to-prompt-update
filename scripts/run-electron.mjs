import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { acquireElectronCliLock } from './lib/electron-cli-lock.mjs';

const require = createRequire(import.meta.url);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const electronAppDirectory = path.resolve(repositoryRoot, 'apps/electron');
const args = process.argv.slice(2);
const lock = await acquireElectronCliLock(repositoryRoot, { args });

if (!lock.acquired) {
  console.error(
    `Another Electron command is already running for this project (pid ${lock.existingLock.pid}).`
  );
  console.error('Stop the existing desktop process before starting a new one.');
  process.exit(1);
}

const electronBinary = require('electron');
const child = spawn(electronBinary, ['.', ...args], {
  cwd: electronAppDirectory,
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: undefined
  }
});

async function cleanup() {
  await lock.release();
}

child.on('exit', (code, signal) => {
  cleanup()
    .catch((error) => {
      console.error(`Failed to clean up the Electron runner: ${error.message}`);
    })
    .finally(() => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      process.exit(code ?? 1);
    });
});

child.on('error', (error) => {
  cleanup()
    .catch((cleanupError) => {
      console.error(`Failed to clean up the Electron runner: ${cleanupError.message}`);
    })
    .finally(() => {
      console.error(`Failed to start Electron: ${error.message}`);
      process.exit(1);
    });
});
