import { BUILD_TRANSFORM_RESULT_TASK } from '../../../packages/host-contracts/src/task-types.js';

export function createElectronWorkerForTask(
  taskType,
  { WorkerCtor = globalThis.Worker } = {}
) {
  if (taskType !== BUILD_TRANSFORM_RESULT_TASK || typeof WorkerCtor !== 'function') {
    return null;
  }

  return () =>
    new WorkerCtor(new URL('./workers/transform-task.worker.js', import.meta.url), {
      type: 'module'
    });
}
