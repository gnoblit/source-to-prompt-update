import { createTransformPlan } from '../models/transform-plan.js';

function countLines(text) {
  return String(text).split('\n').length;
}

function byteSize(text) {
  return new TextEncoder().encode(String(text)).length;
}

function trimTrailingWhitespace(content) {
  return String(content)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

export function removeCommentsHeuristic(path, content) {
  const lowerPath = String(path).toLowerCase();
  let result = String(content);

  if (
    lowerPath.endsWith('.js') ||
    lowerPath.endsWith('.jsx') ||
    lowerPath.endsWith('.ts') ||
    lowerPath.endsWith('.tsx') ||
    lowerPath.endsWith('.java') ||
    lowerPath.endsWith('.go') ||
    lowerPath.endsWith('.c') ||
    lowerPath.endsWith('.cpp') ||
    lowerPath.endsWith('.h') ||
    lowerPath.endsWith('.rs') ||
    lowerPath.endsWith('.php')
  ) {
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    result = result.replace(/(^|\s)\/\/.*$/gm, '');
  } else if (lowerPath.endsWith('.py') || lowerPath.endsWith('.rb')) {
    result = result.replace(/^\s*#.*$/gm, '');
  } else if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) {
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  } else if (lowerPath.endsWith('.css')) {
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  return trimTrailingWhitespace(result);
}

export function applySafeMinify(path, content) {
  const lowerPath = String(path).toLowerCase();
  const normalized = String(content);

  if (lowerPath.endsWith('.json')) {
    try {
      return {
        content: JSON.stringify(JSON.parse(normalized)),
        warning: null,
        applied: true
      };
    } catch {
      return {
        content: normalized,
        warning: `Safe minify skipped for ${path} because JSON parsing failed.`,
        applied: false
      };
    }
  }

  if (
    lowerPath.endsWith('.txt') ||
    lowerPath.endsWith('.md') ||
    lowerPath.endsWith('.js') ||
    lowerPath.endsWith('.jsx') ||
    lowerPath.endsWith('.mjs') ||
    lowerPath.endsWith('.cjs') ||
    lowerPath.endsWith('.ts') ||
    lowerPath.endsWith('.tsx') ||
    lowerPath.endsWith('.css') ||
    lowerPath.endsWith('.html') ||
    lowerPath.endsWith('.htm') ||
    lowerPath.endsWith('.py') ||
    lowerPath.endsWith('.rb') ||
    lowerPath.endsWith('.go') ||
    lowerPath.endsWith('.rs') ||
    lowerPath.endsWith('.java') ||
    lowerPath.endsWith('.php') ||
    lowerPath.endsWith('.sh')
  ) {
    return {
      content: trimTrailingWhitespace(normalized),
      warning: null,
      applied: true
    };
  }

  return {
    content: normalized,
    warning: `Safe minify skipped for ${path} because no conservative strategy is defined for this file type.`,
    applied: false
  };
}

export function buildTransformPlan({ selectedFiles = [], options = {} } = {}) {
  const transforms = [];
  const warnings = [];

  if (options.removeComments === true) {
    transforms.push({
      kind: 'remove-comments',
      safetyClass: 'unsafe'
    });
    warnings.push(
      'Comment removal uses heuristics and may alter semantics for some languages or edge cases.'
    );
  }

  if (options.minify === true || options.minifyOutput === true) {
    transforms.push({
      kind: 'safe-minify',
      safetyClass: 'safe'
    });
  }

  const safetyClass = transforms.some((transform) => transform.safetyClass === 'unsafe')
    ? 'unsafe'
    : 'safe';

  const totalBytes = selectedFiles.reduce((sum, file) => sum + byteSize(file.content), 0);
  const executionStrategy =
    transforms.length > 0 && (selectedFiles.length >= 20 || totalBytes >= 512 * 1024)
      ? 'background-preferred'
      : 'inline';

  return createTransformPlan({
    transforms,
    safetyClass,
    executionStrategy,
    warnings
  });
}

export async function buildTransformResult({ selectedFiles = [], options = {} } = {}) {
  const plan = buildTransformPlan({ selectedFiles, options });
  const warnings = [...plan.warnings];

  let originalTotalSize = 0;
  let originalTotalLines = 0;
  let afterCommentTotalSize = 0;
  let afterCommentTotalLines = 0;
  let afterMinifyTotalSize = 0;
  let afterMinifyTotalLines = 0;

  const transformedFiles = [];
  const transformProvenance = [];

  for (const file of selectedFiles) {
    originalTotalSize += byteSize(file.content);
    originalTotalLines += countLines(file.content);

    let afterComments = file.content;
    let commentRemoved = false;
    if (options.removeComments === true) {
      const candidate = removeCommentsHeuristic(file.path, afterComments);
      commentRemoved = candidate !== afterComments;
      afterComments = candidate;
    }

    afterCommentTotalSize += byteSize(afterComments);
    afterCommentTotalLines += countLines(afterComments);

    let finalContent = afterComments;
    let minifyApplied = false;
    if (options.minify === true || options.minifyOutput === true) {
      const minifyResult = applySafeMinify(file.path, finalContent);
      finalContent = minifyResult.content;
      minifyApplied = minifyResult.applied;
      if (minifyResult.warning) {
        warnings.push(minifyResult.warning);
      }
    }

    afterMinifyTotalSize += byteSize(finalContent);
    afterMinifyTotalLines += countLines(finalContent);

    transformedFiles.push({
      ...file,
      content: finalContent,
      lines: countLines(finalContent)
    });

    transformProvenance.push({
      path: file.path,
      removeComments: options.removeComments === true ? (commentRemoved ? 'applied' : 'no-change') : 'disabled',
      minify: options.minify === true || options.minifyOutput === true
        ? (minifyApplied ? 'applied' : 'skipped-or-no-change')
        : 'disabled'
    });
  }

  return {
    plan,
    transformedFiles,
    transformProvenance,
    warnings,
    stats: {
      originalTotalSize,
      originalTotalLines,
      afterCommentTotalSize,
      afterCommentTotalLines,
      afterMinifyTotalSize,
      afterMinifyTotalLines
    }
  };
}
