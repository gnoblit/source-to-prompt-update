import { runWorkerTask } from '../../host-contracts/src/web-worker-task-runner.js';
import { normalizeElectronBridge } from './electron-bridge.js';

export function createElectronTaskHost({ bridge, createWorkerForTask = null } = {}) {
  const electronBridge = normalizeElectronBridge(bridge);

  return {
    async runTask({ operationName = null, taskType = null, payload = null, workerFactory, signal, timeoutMs = 90000 } = {}) {
      const resolvedWorkerFactory =
        workerFactory ||
        (typeof createWorkerForTask === 'function' ? createWorkerForTask(taskType) : null);

      if (typeof resolvedWorkerFactory === 'function') {
        return runWorkerTask({
          workerFactory: resolvedWorkerFactory,
          taskType,
          payload,
          signal,
          timeoutMs
        });
      }

      if (operationName) {
        return electronBridge.callOperation(operationName, payload);
      }

      return electronBridge.call('runTask', {
        taskType,
        payload
      });
    },

    async runInlineTask(task, payload) {
      if (typeof task !== 'function') {
        throw new TypeError('runInlineTask requires a task function');
      }

      return task(payload);
    }
  };
}
