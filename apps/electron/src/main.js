import { createAppController } from '../../../packages/application/src/controller/create-app-controller.js';
import { assertDiagnosticsHost } from '../../../packages/host-contracts/src/diagnostics-host.js';
import { assertOutputHost } from '../../../packages/host-contracts/src/output-host.js';
import { assertPersistenceHost } from '../../../packages/host-contracts/src/persistence-host.js';
import { assertRepositoryHost } from '../../../packages/host-contracts/src/repository-host.js';
import { assertTaskHost } from '../../../packages/host-contracts/src/task-host.js';
import { createElectronDiagnosticsHost } from '../../../packages/host-impl-electron/src/electron-diagnostics-host.js';
import { createElectronOutputHost } from '../../../packages/host-impl-electron/src/electron-output-host.js';
import { createElectronPersistenceHost } from '../../../packages/host-impl-electron/src/electron-persistence-host.js';
import { createElectronRepositoryHost } from '../../../packages/host-impl-electron/src/electron-repository-host.js';
import { createElectronTaskHost } from '../../../packages/host-impl-electron/src/electron-task-host.js';
import { createElectronWorkerForTask } from './task-workers.js';

export function createElectronHosts({ bridge, onDiagnosticsChange } = {}) {
  if (!bridge) {
    throw new TypeError('createElectronHosts requires an Electron bridge');
  }

  return {
    repositoryHost: createElectronRepositoryHost({ bridge }),
    persistenceHost: createElectronPersistenceHost({ bridge }),
    taskHost: createElectronTaskHost({
      bridge,
      createWorkerForTask: createElectronWorkerForTask
    }),
    outputHost: createElectronOutputHost({ bridge }),
    diagnosticsHost: createElectronDiagnosticsHost({
      onChange: onDiagnosticsChange
    })
  };
}

export function bootElectronApp({
  bridge = null,
  repositoryHost,
  persistenceHost,
  taskHost,
  outputHost,
  diagnosticsHost,
  onDiagnosticsChange
} = {}) {
  const defaultHosts = bridge
    ? createElectronHosts({
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
    host: 'electron'
  });

  return {
    controller,
    hosts
  };
}
