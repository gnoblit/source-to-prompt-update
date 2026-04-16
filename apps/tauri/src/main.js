import { createAppController } from '../../../packages/application/src/controller/create-app-controller.js';
import { createTauriDiagnosticsHost } from '../../../packages/host-impl-tauri/src/tauri-diagnostics-host.js';
import { createTauriOutputHost } from '../../../packages/host-impl-tauri/src/tauri-output-host.js';
import { createTauriPersistenceHost } from '../../../packages/host-impl-tauri/src/tauri-persistence-host.js';
import { createTauriRepositoryHost } from '../../../packages/host-impl-tauri/src/tauri-repository-host.js';
import { createTauriTaskHost } from '../../../packages/host-impl-tauri/src/tauri-task-host.js';
import { assertDiagnosticsHost } from '../../../packages/host-contracts/src/diagnostics-host.js';
import { assertOutputHost } from '../../../packages/host-contracts/src/output-host.js';
import { assertPersistenceHost } from '../../../packages/host-contracts/src/persistence-host.js';
import { assertRepositoryHost } from '../../../packages/host-contracts/src/repository-host.js';
import { assertTaskHost } from '../../../packages/host-contracts/src/task-host.js';
import { createTauriWorkerForTask } from './task-workers.js';

export function createTauriHosts({ bridge, onDiagnosticsChange } = {}) {
  if (!bridge) {
    throw new TypeError('createTauriHosts requires a Tauri bridge');
  }

  return {
    repositoryHost: createTauriRepositoryHost({ bridge }),
    persistenceHost: createTauriPersistenceHost({ bridge }),
    taskHost: createTauriTaskHost({
      bridge,
      createWorkerForTask: createTauriWorkerForTask
    }),
    outputHost: createTauriOutputHost({ bridge }),
    diagnosticsHost: createTauriDiagnosticsHost({
      onChange: onDiagnosticsChange
    })
  };
}

export function bootTauriApp({
  bridge = null,
  repositoryHost,
  persistenceHost,
  taskHost,
  outputHost,
  diagnosticsHost,
  onDiagnosticsChange
} = {}) {
  const defaultHosts = bridge
    ? createTauriHosts({
        bridge,
        onDiagnosticsChange
      })
    : {};

  const hosts = {
    repositoryHost: assertRepositoryHost(repositoryHost || defaultHosts.repositoryHost),
    persistenceHost: assertPersistenceHost(persistenceHost || defaultHosts.persistenceHost),
    taskHost: assertTaskHost(taskHost || defaultHosts.taskHost),
    outputHost: assertOutputHost(outputHost || defaultHosts.outputHost),
    diagnosticsHost: assertDiagnosticsHost(diagnosticsHost || defaultHosts.diagnosticsHost)
  };

  const controller = createAppController({
    repositoryHost: hosts.repositoryHost,
    persistenceHost: hosts.persistenceHost,
    taskHost: hosts.taskHost,
    host: 'tauri'
  });

  return {
    controller,
    hosts
  };
}
