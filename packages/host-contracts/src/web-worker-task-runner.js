export function runWorkerTask({
  workerFactory,
  taskType,
  payload,
  timeoutMs = 90000
} = {}) {
  if (typeof workerFactory !== 'function') {
    throw new TypeError('runWorkerTask requires a workerFactory');
  }

  const worker = workerFactory();
  if (!worker || typeof worker.postMessage !== 'function') {
    throw new TypeError('runWorkerTask requires a worker-like object');
  }

  return new Promise((resolve, reject) => {
    let timeoutHandle = null;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      worker.removeEventListener?.('message', onMessage);
      worker.removeEventListener?.('error', onError);
      worker.terminate?.();
    };

    const onMessage = (event) => {
      cleanup();

      const data = event?.data;
      if (!data || data.ok !== true) {
        reject(new Error(data?.error || 'Worker task failed'));
        return;
      }

      resolve(data.result);
    };

    const onError = (event) => {
      cleanup();
      reject(new Error(event?.message || 'Worker task failed'));
    };

    worker.addEventListener?.('message', onMessage);
    worker.addEventListener?.('error', onError);
    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error('Worker task timed out'));
    }, timeoutMs);

    worker.postMessage({
      taskType,
      payload
    });
  });
}
