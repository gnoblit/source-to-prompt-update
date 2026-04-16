import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { acquireTauriCliLock } from './lib/tauri-cli-lock.mjs';
import { createTauriCliExecutionEnvironment } from './lib/tauri-dev-env.mjs';
import {
  startTauriFrontendDistWatcher,
  syncTauriFrontendDist
} from './lib/tauri-frontend-dist.mjs';

const args = process.argv.slice(2);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

if (args.length === 0) {
  console.error('Usage: node scripts/run-tauri-cli.mjs <dev|build|...args>');
  process.exit(1);
}

const action = args[0];
const lock = await acquireTauriCliLock(repositoryRoot, { args });

if (!lock.acquired) {
  console.error(
    `Another Tauri CLI command is already running for this project (pid ${lock.existingLock.pid}).`
  );
  console.error('Refusing to reuse the shared staged frontend while another desktop run owns it.');
  console.error('');
  console.error('Options:');
  console.error('  1. Wait for the other Tauri command to finish, then rerun this command.');
  console.error('  2. Stop the other Tauri command before starting a new one.');
  process.exit(1);
}

let frontendWatcher = null;

try {
  const syncResult = await syncTauriFrontendDist(repositoryRoot);

  if (action === 'dev') {
    frontendWatcher = await startTauriFrontendDistWatcher(repositoryRoot, {
      initialSnapshot: syncResult.snapshot,
      onError(error) {
        console.error(`Failed to keep the staged Tauri frontend fresh: ${error.message}`);
      }
    });
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['exec', 'tauri', '--', ...args], {
    stdio: 'inherit',
    env: createTauriCliExecutionEnvironment()
  });

  async function cleanup() {
    if (frontendWatcher) {
      await frontendWatcher.stop();
      frontendWatcher = null;
    }

    await lock.release();
  }

  child.on('exit', (code, signal) => {
    cleanup()
      .catch((error) => {
        console.error(`Failed to clean up the Tauri runner: ${error.message}`);
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
        console.error(`Failed to clean up the Tauri runner: ${cleanupError.message}`);
      })
      .finally(() => {
        console.error(`Failed to start tauri ${action} via npm exec: ${error.message}`);
        process.exit(1);
      });
  });
} catch (error) {
  await lock.release().catch(() => {});
  console.error(error?.message || String(error));
  process.exit(1);
}
