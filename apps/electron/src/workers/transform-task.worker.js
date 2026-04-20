import { buildTransformResult } from '../../../../packages/core/src/transforms/transform-engine.js';
import { BUILD_TRANSFORM_RESULT_TASK } from '../../../../packages/host-contracts/src/task-types.js';

self.addEventListener('message', async (event) => {
  const { taskType, payload } = event.data || {};

  if (taskType !== BUILD_TRANSFORM_RESULT_TASK) {
    self.postMessage({
      ok: false,
      error: `Unsupported worker task type: ${taskType || 'unknown'}`
    });
    return;
  }

  try {
    const result = await buildTransformResult(payload || {});
    self.postMessage({
      ok: true,
      result
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error?.message || 'Transform worker failed'
    });
  }
});
