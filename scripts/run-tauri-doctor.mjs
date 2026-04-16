import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import { detectDoctorTarget } from './lib/tauri-dev-env.mjs';

const target = process.argv[2] || detectDoctorTarget();
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

const scriptByTarget = {
  linux: path.resolve(repositoryRoot, 'scripts/check-tauri-linux-deps.sh'),
  windows: path.resolve(repositoryRoot, 'scripts/check-tauri-windows-deps.ps1')
};

if (!scriptByTarget[target]) {
  console.error(`Unknown Tauri doctor target: ${target}`);
  process.exit(1);
}

const invocation =
  target === 'windows'
    ? {
        command: 'powershell',
        args: ['-ExecutionPolicy', 'Bypass', '-File', scriptByTarget[target]]
      }
    : {
        command: 'bash',
        args: [scriptByTarget[target]]
      };

const child = spawn(invocation.command, invocation.args, {
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Failed to start Tauri doctor for ${target}: ${error.message}`);
  process.exit(1);
});
