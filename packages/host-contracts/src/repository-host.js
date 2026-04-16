export function assertRepositoryHost(host) {
  const required = [
    'canSerializeRepositoryHandle',
    'serializeRepositoryHandle',
    'selectRepository',
    'restoreRepository',
    'listDirectory',
    'readTextFile',
    'readFileMetadata',
    'resolvePath'
  ];

  for (const key of required) {
    if (!host || typeof host[key] !== 'function') {
      throw new TypeError(`RepositoryHost is missing required method: ${key}`);
    }
  }

  return host;
}
