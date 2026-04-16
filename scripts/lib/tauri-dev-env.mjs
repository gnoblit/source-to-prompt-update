import path from 'node:path';
import os from 'node:os';

export function detectDoctorTarget(platform = process.platform) {
  return platform === 'win32' ? 'windows' : 'linux';
}

export function getCargoBinDirectory({
  env = process.env,
  platform = process.platform
} = {}) {
  const pathModule = platform === 'win32' ? path.win32 : path.posix;

  if (env.CARGO_HOME) {
    return pathModule.join(env.CARGO_HOME, 'bin');
  }

  if (platform === 'win32' && env.USERPROFILE) {
    return pathModule.join(env.USERPROFILE, '.cargo', 'bin');
  }

  if (env.HOME) {
    return pathModule.join(env.HOME, '.cargo', 'bin');
  }

  return null;
}

export function createCargoExecutionEnvironment({
  env = process.env,
  platform = process.platform
} = {}) {
  const nextEnv = { ...env };
  const cargoBin = getCargoBinDirectory({ env, platform });
  if (!cargoBin) {
    return nextEnv;
  }

  const delimiter = platform === 'win32' ? ';' : ':';
  const currentPath = nextEnv.PATH || '';
  const pathEntries = currentPath.split(delimiter).filter(Boolean);

  if (!pathEntries.includes(cargoBin)) {
    nextEnv.PATH = currentPath ? `${cargoBin}${delimiter}${currentPath}` : cargoBin;
  }

  return nextEnv;
}

export function isWslEnvironment({
  env = process.env,
  platform = process.platform,
  release = os.release()
} = {}) {
  if (platform !== 'linux') {
    return false;
  }

  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) {
    return true;
  }

  return /microsoft/i.test(release);
}

export function createTauriCliExecutionEnvironment({
  env = process.env,
  platform = process.platform,
  release = os.release()
} = {}) {
  const nextEnv = createCargoExecutionEnvironment({ env, platform });

  if (!isWslEnvironment({ env, platform, release })) {
    return nextEnv;
  }

  if (!nextEnv.LIBGL_ALWAYS_SOFTWARE) {
    nextEnv.LIBGL_ALWAYS_SOFTWARE = '1';
  }

  if (!nextEnv.GSK_RENDERER) {
    nextEnv.GSK_RENDERER = 'cairo';
  }

  if (!nextEnv.WEBKIT_DISABLE_COMPOSITING_MODE) {
    nextEnv.WEBKIT_DISABLE_COMPOSITING_MODE = '1';
  }

  return nextEnv;
}

export function getCargoInvocation({
  action,
  manifestPath,
  extraArgs = []
} = {}) {
  if (!action) {
    throw new TypeError('getCargoInvocation requires an action');
  }

  if (!manifestPath) {
    throw new TypeError('getCargoInvocation requires a manifestPath');
  }

  return {
    command: 'cargo',
    args: [action, '--manifest-path', manifestPath, ...extraArgs]
  };
}
