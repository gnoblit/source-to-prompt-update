import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  createCargoExecutionEnvironment,
  detectDoctorTarget,
  getCargoBinDirectory,
  getCargoInvocation
} from '../../scripts/lib/tauri-dev-env.mjs';

test('detectDoctorTarget selects windows only for win32', () => {
  assert.equal(detectDoctorTarget('linux'), 'linux');
  assert.equal(detectDoctorTarget('darwin'), 'linux');
  assert.equal(detectDoctorTarget('win32'), 'windows');
});

test('getCargoBinDirectory resolves cargo bin paths per platform', () => {
  assert.equal(
    getCargoBinDirectory({
      platform: 'linux',
      env: { HOME: '/home/graham' }
    }),
    '/home/graham/.cargo/bin'
  );

  assert.equal(
    getCargoBinDirectory({
      platform: 'win32',
      env: { USERPROFILE: 'C:\\Users\\graham' }
    }),
    path.win32.join('C:\\Users\\graham', '.cargo', 'bin')
  );

  assert.equal(
    getCargoBinDirectory({
      platform: 'linux',
      env: { CARGO_HOME: '/tmp/cargo-home' }
    }),
    '/tmp/cargo-home/bin'
  );
});

test('createCargoExecutionEnvironment prepends cargo bin when missing', () => {
  const linuxEnv = createCargoExecutionEnvironment({
    platform: 'linux',
    env: {
      HOME: '/home/graham',
      PATH: '/usr/local/bin:/usr/bin'
    }
  });

  assert.equal(
    linuxEnv.PATH,
    '/home/graham/.cargo/bin:/usr/local/bin:/usr/bin'
  );

  const windowsEnv = createCargoExecutionEnvironment({
    platform: 'win32',
    env: {
      USERPROFILE: 'C:\\Users\\graham',
      PATH: 'C:\\Windows\\System32;C:\\Program Files\\Git\\bin'
    }
  });

  assert.match(
    windowsEnv.PATH,
    new RegExp(`^${path.win32.join('C:\\\\Users\\\\graham', '.cargo', 'bin').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`)
  );
});

test('createCargoExecutionEnvironment avoids duplicating cargo bin entries', () => {
  const env = createCargoExecutionEnvironment({
    platform: 'linux',
    env: {
      HOME: '/home/graham',
      PATH: '/home/graham/.cargo/bin:/usr/bin'
    }
  });

  assert.equal(env.PATH, '/home/graham/.cargo/bin:/usr/bin');
});

test('getCargoInvocation builds cargo commands for the tauri manifest', () => {
  const invocation = getCargoInvocation({
    action: 'check',
    manifestPath: '/repo/apps/tauri/src-tauri/Cargo.toml',
    extraArgs: ['--quiet']
  });

  assert.equal(invocation.command, 'cargo');
  assert.deepEqual(invocation.args, [
    'check',
    '--manifest-path',
    '/repo/apps/tauri/src-tauri/Cargo.toml',
    '--quiet'
  ]);
});
