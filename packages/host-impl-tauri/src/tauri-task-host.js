import { normalizeTauriBridge } from './tauri-bridge.js';
import { runWorkerTask } from '../../host-contracts/src/web-worker-task-runner.js';

export function createTauriTaskHost({ bridge, createWorkerForTask = null } = {}) {
  const tauriBridge = normalizeTauriBridge(bridge);

  return {
    async runTask({ commandName = null, taskType = null, payload = null, workerFactory, timeoutMs = 90000 } = {}) {
      const resolvedWorkerFactory =
        workerFactory ||
        (typeof createWorkerForTask === 'function' ? createWorkerForTask(taskType) : null);

      if (typeof resolvedWorkerFactory === 'function') {
        return runWorkerTask({
          workerFactory: resolvedWorkerFactory,
          taskType,
          payload,
          timeoutMs
        });
      }

      if (commandName) {
        return tauriBridge.callCommand(commandName, payload);
      }

      return tauriBridge.call('runTask', {
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
