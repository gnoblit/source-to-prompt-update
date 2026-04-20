import { execFile as execFileCallback } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { getElectronCliLockPath } from './lib/electron-cli-lock.mjs';

const execFile = promisify(execFileCallback);

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false;
    }

    if (error?.code === 'EPERM') {
      return true;
    }

    throw error;
  }
}

async function readLock(lockPath) {
  try {
    return JSON.parse(await readFile(lockPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function getChildProcessIds(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return [];
  }

  try {
    const { stdout } = await execFile('ps', ['-o', 'pid=', '--ppid', String(pid)]);
    return stdout
      .split('\n')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

async function getProcessTreePids(rootPid, seen = new Set()) {
  if (!Number.isInteger(rootPid) || rootPid <= 0 || seen.has(rootPid)) {
    return [];
  }

  seen.add(rootPid);
  const children = await getChildProcessIds(rootPid);
  const descendants = [];

  for (const childPid of children) {
    descendants.push(...(await getProcessTreePids(childPid, seen)));
  }

  descendants.push(rootPid);
  return descendants;
}

function signalProcessList(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        throw error;
      }
    }
  }
}

async function waitForProcessListExit(pids, timeoutMs = 3000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (pids.every((pid) => !isProcessAlive(pid))) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return pids.every((pid) => !isProcessAlive(pid));
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const lockPath = getElectronCliLockPath(repositoryRoot);
const lock = await readLock(lockPath);

if (!lock) {
  console.log('No Electron desktop process is currently registered for this repo.');
  process.exit(0);
}

const pid = Number(lock.pid);

if (!isProcessAlive(pid)) {
  await rm(lockPath, { force: true });
  console.log(`Removed stale Electron lock for exited pid ${pid}.`);
  process.exit(0);
}

const processTree = await getProcessTreePids(pid);

signalProcessList(processTree, 'SIGTERM');

if (await waitForProcessListExit(processTree)) {
  await rm(lockPath, { force: true });
  console.log(`Stopped Electron desktop process tree rooted at ${pid}.`);
  process.exit(0);
}

signalProcessList(processTree, 'SIGKILL');

if (await waitForProcessListExit(processTree, 1000)) {
  await rm(lockPath, { force: true });
  console.log(`Force-stopped Electron desktop process tree rooted at ${pid}.`);
  process.exit(0);
}

console.error(`Unable to stop Electron desktop process tree rooted at ${pid}.`);
process.exit(1);
