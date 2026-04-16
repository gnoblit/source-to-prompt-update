const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.csv',
  '.js',
  '.css',
  '.html',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.ini',
  '.log',
  '.sh',
  '.bash',
  '.py',
  '.java',
  '.cpp',
  '.c',
  '.h',
  '.config',
  '.env',
  '.gitignore',
  '.sql',
  '.ts',
  '.tsx',
  '.schema',
  '.mjs',
  '.cjs',
  '.jsx',
  '.rs',
  '.go',
  '.php',
  '.rb',
  '.toml',
  '.prisma',
  '.bat',
  '.ps1',
  '.svelte',
  '.lock'
]);

const EXACT_TEXT_NAMES = new Set(['Makefile', 'Dockerfile']);

const DOTFILE_TEXT_NAMES = new Set([
  '.gitignore',
  '.gitattributes',
  '.dockerignore',
  '.npmignore',
  '.eslintignore',
  '.prettierignore',
  '.editorconfig',
  '.npmrc',
  '.yarnrc',
  '.yarnrc.yml',
  '.pnpmfile.cjs',
  '.pnpmfile.js',
  '.nvmrc',
  '.node-version',
  '.tool-versions',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.babelrc',
  '.babelrc.json',
  '.stylelintrc',
  '.stylelintrc.json',
  '.stylelintrc.yaml',
  '.stylelintrc.yml',
  '.stylelintrc.js',
  '.stylelintrc.cjs'
]);

function getLeafName(fileName) {
  if (typeof fileName !== 'string') {
    return '';
  }
  return fileName.split('/').pop()?.split('\\').pop() || '';
}

export function isLikelyTextFile(fileName) {
  const leafName = getLeafName(fileName);
  const lowerName = leafName.toLowerCase();

  if (!leafName) {
    return false;
  }

  if (EXACT_TEXT_NAMES.has(leafName)) {
    return true;
  }

  if (DOTFILE_TEXT_NAMES.has(lowerName)) {
    return true;
  }

  if (lowerName.startsWith('.env')) {
    return true;
  }

  if (lowerName.startsWith('.') && lowerName.endsWith('rc')) {
    return true;
  }

  for (const ext of TEXT_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

export const textFileRules = {
  TEXT_EXTENSIONS,
  EXACT_TEXT_NAMES,
  DOTFILE_TEXT_NAMES
};
