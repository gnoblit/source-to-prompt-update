export function assertOutputHost(host) {
  const required = ['copyText', 'saveText', 'downloadText'];

  for (const key of required) {
    if (!host || typeof host[key] !== 'function') {
      throw new TypeError(`OutputHost is missing required method: ${key}`);
    }
  }

  return host;
}
