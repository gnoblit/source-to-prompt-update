import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import {
  createCargoExecutionEnvironment,
  getCargoInvocation
} from './lib/tauri-dev-env.mjs';
import { syncTauriFrontendDist } from './lib/tauri-frontend-dist.mjs';

const action = process.argv[2];
const extraArgs = process.argv.slice(3);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

if (!action) {
  console.error('Usage: node scripts/run-tauri-cargo.mjs <check|run|build> [...args]');
  process.exit(1);
}

const manifestPath = path.resolve(repositoryRoot, 'apps/tauri/src-tauri/Cargo.toml');

function detectCompetingCargoInvocation() {
  if (process.platform === 'win32') {
    return null;
  }

  const psResult = spawnSync(
    'ps',
    ['-eo', 'pid=,args='],
    {
      encoding: 'utf8'
    }
  );

  if (psResult.status !== 0) {
    return null;
  }

  const currentPid = process.pid;
  const manifestSnippet = 'apps/tauri/src-tauri/Cargo.toml';

  for (const line of psResult.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace === -1) {
      continue;
    }

    const pid = Number(trimmed.slice(0, firstSpace));
    const command = trimmed.slice(firstSpace + 1);

    if (!Number.isFinite(pid) || pid === currentPid) {
      continue;
    }

    if (
      command.includes('cargo ') &&
      command.includes(manifestSnippet)
    ) {
      return { pid, command };
    }
  }

  return null;
}

const competingInvocation = detectCompetingCargoInvocation();
if (competingInvocation) {
  console.error(
    `Another Cargo/Tauri build is already running for this project (pid ${competingInvocation.pid}).`
  );
  console.error('Refusing to wait on Cargo\'s build lock because that often looks like a hang.');
  console.error('');
  console.error('Options:');
  console.error('  1. Wait for the other build to finish, then rerun this command.');
  console.error('  2. Stop the other build before starting a new one.');
  console.error(
    '  3. Run with a fresh target dir, e.g. CARGO_TARGET_DIR=/tmp/ysp-tauri-check npm run tauri:check'
  );
  process.exit(1);
}

await syncTauriFrontendDist(repositoryRoot);

const invocation = getCargoInvocation({
  action,
  manifestPath,
  extraArgs
});

const child = spawn(invocation.command, invocation.args, {
  stdio: 'inherit',
  env: createCargoExecutionEnvironment()
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Failed to start cargo ${action}: ${error.message}`);
  process.exit(1);
});
