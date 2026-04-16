function cloneArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

export function createPromptSection(input = {}) {
  return {
    kind: input.kind || 'note',
    title: typeof input.title === 'string' ? input.title : '',
    text: typeof input.text === 'string' ? input.text : ''
  };
}

export function createPromptBundleFile(input = {}) {
  return {
    path: input.path || '',
    content: typeof input.content === 'string' ? input.content : '',
    size: typeof input.size === 'number' ? input.size : 0,
    lines: typeof input.lines === 'number' ? input.lines : 0
  };
}

export function createPromptBundle(input = {}) {
  return {
    metadata: input.metadata || {},
    repositoryStructure: typeof input.repositoryStructure === 'string' ? input.repositoryStructure : '',
    promptSections: cloneArray(input.promptSections).map(createPromptSection),
    files: cloneArray(input.files).map(createPromptBundleFile),
    transformProvenance: cloneArray(input.transformProvenance),
    warnings: cloneArray(input.warnings),
    stats: input.stats || null
  };
}
