export function assertDiagnosticsHost(host) {
  const required = ['append', 'clear', 'exportEntries'];

  for (const key of required) {
    if (!host || typeof host[key] !== 'function') {
      throw new TypeError(`DiagnosticsHost is missing required method: ${key}`);
    }
  }

  return host;
}
