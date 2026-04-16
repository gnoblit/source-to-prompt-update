import { createAppController } from '../../../packages/application/src/controller/create-app-controller.js';
import { createBrowserDiagnosticsHost } from '../../../packages/host-impl-browser/src/browser-diagnostics-host.js';
import { createBrowserOutputHost } from '../../../packages/host-impl-browser/src/browser-output-host.js';
import { createBrowserPersistenceHost } from '../../../packages/host-impl-browser/src/browser-persistence-host.js';
import { createBrowserRepositoryHost } from '../../../packages/host-impl-browser/src/browser-repository-host.js';
import { createBrowserTaskHost } from '../../../packages/host-impl-browser/src/browser-task-host.js';
import { createBrowserWorkerForTask } from './task-workers.js';

export function bootBrowserApp({
  windowObject = globalThis.window,
  storage = globalThis.localStorage,
  onDiagnosticsChange
} = {}) {
  const repositoryHost = createBrowserRepositoryHost({ windowObject });
  const persistenceHost = createBrowserPersistenceHost({ storage });
  const taskHost = createBrowserTaskHost({
    createWorkerForTask: createBrowserWorkerForTask
  });
  const outputHost = createBrowserOutputHost({ windowObject });
  const diagnosticsHost = createBrowserDiagnosticsHost({
    onChange: onDiagnosticsChange
  });

  const controller = createAppController({
    repositoryHost,
    persistenceHost,
    taskHost,
    host: 'browser'
  });

  return {
    controller,
    hosts: {
      repositoryHost,
      persistenceHost,
      taskHost,
      outputHost,
      diagnosticsHost
    }
  };
}
