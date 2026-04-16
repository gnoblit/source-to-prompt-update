export function assertPersistenceHost(host) {
  const required = ['getItem', 'setItem', 'removeItem'];

  for (const key of required) {
    if (!host || typeof host[key] !== 'function') {
      throw new TypeError(`PersistenceHost is missing required method: ${key}`);
    }
  }

  return host;
}
