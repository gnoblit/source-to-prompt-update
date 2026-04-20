const DEFAULT_PATTERN_SOURCES = [
  '^.git(?:$|/)',
  '^.husky(?:$|/)',
  '^.vscode(?:$|/)',
  '^\\.venv(?:$|/)',
  '^venv(?:$|/)',
  '^\\.direnv(?:$|/)',
  '^node_modules(?:$|/)',
  '^\\.next(?:$|/)',
  '^out(?:$|/)',
  '^build(?:$|/)',
  '^coverage(?:$|/)',
  '^__pycache__(?:$|/)',
  '\\.DS_Store$',
  '\\.env\\.*',
  '\\.pnp\\.*',
  '\\.yarn/*',
  '\\.vercel(?:$|/)',
  '\\.tsbuildinfo$',
  '^next-env\\.d\\.ts$',
  '(?:^|/)package-lock\\.json$',
  '(?:^|/)npm-shrinkwrap\\.json$',
  '(?:^|/)pnpm-lock\\.yaml$',
  '(?:^|/)pnpm-lock\\.yml$',
  '(?:^|/)yarn\\.lock$',
  '(?:^|/)bun\\.lock$',
  '(?:^|/)bun\\.lockb$',
  '(?:^|/)Cargo\\.lock$',
  '(?:^|/)Gemfile\\.lock$',
  '(?:^|/)composer\\.lock$',
  '(?:^|/)Podfile\\.lock$',
  '(?:^|/)Pipfile\\.lock$',
  '(?:^|/)poetry\\.lock$',
  '(?:^|/)uv\\.lock$',
  '(?:^|/)\\.electron-cli\\.lock$'
];

function normalizePath(path) {
  if (typeof path !== 'string') {
    return '';
  }
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function compileGitIgnorePattern(pattern) {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const isNegation = trimmed.startsWith('!');
  let source = isNegation ? trimmed.slice(1) : trimmed;

  source = source.replace(/\/+$/, '');
  const isAbsolute = source.startsWith('/');
  source = source.replace(/^\/+/, '');

  const regexPattern = source
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/{{GLOBSTAR}}/g, '.*')
    .replace(/\/$/, '');

  const fullPattern = isAbsolute
    ? `^${regexPattern}(?:$|/)`
    : `(?:^|/)${regexPattern}(?:$|/)`;

  return {
    regex: new RegExp(fullPattern),
    isNegation,
    original: source
  };
}

export class GitIgnoreMatcher {
  constructor(patterns = '') {
    this.patterns = [];

    for (const patternSource of DEFAULT_PATTERN_SOURCES) {
      this.patterns.push({
        regex: new RegExp(patternSource),
        isNegation: false,
        original: patternSource
      });
    }

    for (const line of String(patterns).split('\n')) {
      const compiled = compileGitIgnorePattern(line);
      if (compiled) {
        this.patterns.push(compiled);
      }
    }
  }

  ignores(path) {
    const normalizedPath = normalizePath(path);
    let ignored = false;

    for (const pattern of this.patterns) {
      if (pattern.regex.test(normalizedPath)) {
        ignored = !pattern.isNegation;
      }
    }

    return ignored;
  }

  debugMatches(path) {
    const normalizedPath = normalizePath(path);
    const matches = [];

    for (const pattern of this.patterns) {
      if (pattern.regex.test(normalizedPath)) {
        matches.push({
          pattern: pattern.original,
          isNegation: pattern.isNegation,
          regex: pattern.regex.toString()
        });
      }
    }

    return matches;
  }
}

export const gitIgnoreDefaults = {
  DEFAULT_PATTERN_SOURCES
};
