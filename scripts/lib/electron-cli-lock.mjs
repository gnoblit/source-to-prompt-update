import { open, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

function defaultProcessAlive(pid) {
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

async function readLockFile(lockPath) {
  try {
    const rawLock = await readFile(lockPath, 'utf8');
    return JSON.parse(rawLock);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    return null;
  }
}

export function getElectronCliLockPath(repositoryRoot) {
  return path.resolve(repositoryRoot, 'apps/electron/.electron-cli.lock');
}

export async function acquireElectronCliLock(repositoryRoot, options = {}) {
  if (!repositoryRoot) {
    throw new TypeError('acquireElectronCliLock requires a repository root');
  }

  const pid = Number.isInteger(options.pid) ? options.pid : process.pid;
  const args = Array.isArray(options.args) ? options.args : [];
  const processAlive =
    typeof options.processAlive === 'function' ? options.processAlive : defaultProcessAlive;
  const lockPath = getElectronCliLockPath(repositoryRoot);

  const lockPayload = {
    pid,
    args,
    command: `electron ${args.join(' ')}`.trim(),
    createdAt: typeof options.createdAt === 'string' ? options.createdAt : new Date().toISOString()
  };

  while (true) {
    try {
      const handle = await open(lockPath, 'wx');

      try {
        await handle.writeFile(`${JSON.stringify(lockPayload, null, 2)}\n`);
      } finally {
        await handle.close();
      }

      let released = false;

      return {
        acquired: true,
        lockPath,
        lock: lockPayload,
        async release() {
          if (released) {
            return;
          }

          released = true;
          await rm(lockPath, { force: true });
        }
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      const existingLock = await readLockFile(lockPath);
      if (existingLock && processAlive(existingLock.pid)) {
        return {
          acquired: false,
          lockPath,
          existingLock
        };
      }

      await rm(lockPath, { force: true });
    }
  }
}
