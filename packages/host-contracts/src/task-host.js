export function assertTaskHost(host) {
  const required = ['runTask', 'runInlineTask'];

  for (const key of required) {
    if (!host || typeof host[key] !== 'function') {
      throw new TypeError(`TaskHost is missing required method: ${key}`);
    }
  }

  return host;
}
