import { runWorkerTask } from '../../host-contracts/src/web-worker-task-runner.js';

export function createBrowserTaskHost({ createWorkerForTask = null } = {}) {
  return {
    async runTask({ workerFactory, taskType = null, payload, timeoutMs = 90000 } = {}) {
      const resolvedWorkerFactory =
        workerFactory ||
        (typeof createWorkerForTask === 'function' ? createWorkerForTask(taskType) : null);

      if (typeof resolvedWorkerFactory !== 'function') {
        throw new TypeError('runTask requires a workerFactory');
      }

      return runWorkerTask({
        workerFactory: resolvedWorkerFactory,
        taskType,
        payload,
        timeoutMs
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
