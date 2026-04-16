import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPromptBundle,
  buildRepositoryStructureSummary,
  renderPromptBundleText
} from '../../packages/core/src/output/output-engine.js';

test('builds a repository structure summary from selected files', () => {
  const summary = buildRepositoryStructureSummary([
    { path: 'src/index.ts', size: 128, lines: 10 },
    { path: 'src/components/Button.tsx', size: 256, lines: 20 }
  ]);

  assert.match(summary, /src\//);
  assert.match(summary, /Button\.tsx/);
  assert.match(summary, /Lines: 20/);
});

test('builds a prompt bundle with prompt framing and files', () => {
  const bundle = buildPromptBundle({
    selectedFiles: [
      { path: 'src/index.ts', content: 'console.log("hi")', size: 20, lines: 1 }
    ],
    options: {
      includePreamble: true,
      customPreamble: 'Here is the project.',
      includeGoal: true,
      goalText: 'Refactor safely.'
    },
    transformProvenance: [{ kind: 'none' }],
    warnings: ['Unsafe transforms disabled']
  });

  assert.equal(bundle.files.length, 1);
  assert.equal(bundle.promptSections.length, 3);
  assert.equal(bundle.warnings[0], 'Unsafe transforms disabled');
});

test('renders a prompt bundle to the monolith-compatible text format', () => {
  const bundle = buildPromptBundle({
    selectedFiles: [
      { path: 'src/index.ts', content: 'console.log("hi")', size: 20, lines: 1 }
    ],
    options: {
      includePreamble: true,
      customPreamble: 'Here is the project.',
      includeGoal: true,
      goalText: 'Refactor safely.'
    }
  });

  const rendered = renderPromptBundleText(bundle);

  assert.match(rendered, /^Here is the project\./);
  assert.match(rendered, /Goal:\nRefactor safely\./);
  assert.match(rendered, /Project Structure:/);
  assert.match(rendered, /---\nsrc\/index\.ts\n---\nconsole\.log\("hi"\)/);
});
