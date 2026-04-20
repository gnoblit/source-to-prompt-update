import { buildOutputPresentation } from '../../../core/src/output/output-presentation.js';

export function createOutputState({
  bundle = null,
  renderedText = '',
  fileName = 'combined_files.txt'
} = {}) {
  const presentation = buildOutputPresentation(renderedText);

  return {
    bundle,
    renderedText,
    fileName,
    ...presentation
  };
}

export function createEmptyOutputState(fileName = 'combined_files.txt') {
  return createOutputState({ fileName });
}
