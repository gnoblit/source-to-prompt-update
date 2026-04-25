import {
  createPromptBundle,
  createPromptBundleFile,
  createPromptSection
} from '../models/prompt-bundle.js';

function normalizeSelectedFile(file) {
  return createPromptBundleFile({
    path: file.path,
    content: file.content,
    size: file.size,
    lines: file.lines
  });
}

function buildAsciiTreeObject(selectedFiles) {
  const root = {};

  for (const file of selectedFiles) {
    const parts = file.path.split('/');
    let current = root;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!current[part]) {
        current[part] = {
          __isFile: index === parts.length - 1,
          __size: file.size,
          __lines: file.lines
        };
      }
      if (index < parts.length - 1) {
        current = current[part];
      }
    }
  }

  return root;
}

function printAsciiTree(node, prefix = '', lines = []) {
  const keys = Object.keys(node).filter((key) => !key.startsWith('__')).sort();

  keys.forEach((key, index) => {
    const value = node[key];
    const last = index === keys.length - 1;
    const connector = last ? '└── ' : '├── ';

    if (value.__isFile) {
      const sizeKb = (value.__size / 1024).toFixed(2);
      lines.push(`${prefix}${connector}${key} (Size: ${sizeKb}kb; Lines: ${value.__lines})`);
      return;
    }

    lines.push(`${prefix}${connector}${key}/`);
    const nextPrefix = prefix + (last ? '    ' : '│   ');
    printAsciiTree(value, nextPrefix, lines);
  });

  return lines;
}

export function buildRepositoryStructureSummary(selectedFiles = []) {
  if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) {
    return '';
  }

  const tree = buildAsciiTreeObject(selectedFiles);
  return printAsciiTree(tree).join('\n');
}

export function buildPromptBundle({
  selectedFiles = [],
  options = {},
  metadata = {},
  transformProvenance = [],
  warnings = [],
  stats = null
} = {}) {
  const normalizedFiles = selectedFiles.map(normalizeSelectedFile);
  const promptSections = [];

  if (options.includePreamble && typeof options.customPreamble === 'string' && options.customPreamble.trim()) {
    promptSections.push(
      createPromptSection({
        kind: 'preamble',
        title: '',
        text: options.customPreamble.trim()
      })
    );
  }

  if (options.includeGoal && typeof options.goalText === 'string' && options.goalText.trim()) {
    promptSections.push(
      createPromptSection({
        kind: 'goal',
        title: 'Goal',
        text: options.goalText.trim()
      })
    );
  }

  const repositoryStructure = buildRepositoryStructureSummary(normalizedFiles);
  if (repositoryStructure.trim()) {
    promptSections.push(
      createPromptSection({
        kind: 'repository-structure',
        title: 'Project Structure',
        text: repositoryStructure
      })
    );
  }

  return createPromptBundle({
    metadata,
    repositoryStructure,
    promptSections,
    files: normalizedFiles,
    transformProvenance,
    warnings,
    stats
  });
}

export function renderPromptBundleText(bundle) {
  const parts = [];

  for (const section of bundle.promptSections) {
    if (section.title) {
      parts.push(`${section.title}:\n${section.text}`.trim());
    } else if (section.text) {
      parts.push(section.text.trim());
    }
  }

  for (const file of bundle.files) {
    parts.push(`---\n${file.path}\n---\n${file.content}`.trimEnd());
  }

  return parts.filter(Boolean).join('\n\n').trim();
}
