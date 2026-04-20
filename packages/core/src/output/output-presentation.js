export const OUTPUT_PREVIEW_CHARACTER_LIMIT = 200_000;
export const OUTPUT_COPY_BYTE_LIMIT = 1_048_576;

const textEncoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;

function countLines(text) {
  if (!text) {
    return 0;
  }

  return text.split('\n').length;
}

export function measureTextBytes(text = '') {
  const normalized = typeof text === 'string' ? text : String(text || '');

  if (textEncoder) {
    return textEncoder.encode(normalized).length;
  }

  return normalized.length;
}

export function formatByteCount(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildOutputPresentation(
  renderedText = '',
  {
    previewCharacterLimit = OUTPUT_PREVIEW_CHARACTER_LIMIT,
    copyByteLimit = OUTPUT_COPY_BYTE_LIMIT
  } = {}
) {
  const text = typeof renderedText === 'string' ? renderedText : String(renderedText || '');
  const characters = text.length;
  const bytes = measureTextBytes(text);
  const lines = countLines(text);
  const previewTruncated = characters > previewCharacterLimit;
  const previewText = previewTruncated
    ? `${text.slice(0, previewCharacterLimit).trimEnd()}\n\n[Preview truncated. Save or download to access the full output.]`
    : text;
  const copyAllowed = bytes <= copyByteLimit;

  let summaryText = 'Combined output will appear here.';
  if (characters > 0) {
    summaryText = `${formatByteCount(bytes)} across ${lines.toLocaleString()} lines and ${characters.toLocaleString()} characters.`;

    if (previewTruncated) {
      summaryText += ' Preview truncated in the editor; use Save As or Download for the full bundle.';
    }

    if (!copyAllowed) {
      summaryText += ` Clipboard copy is disabled above ${formatByteCount(copyByteLimit)}.`;
    }
  }

  return {
    previewText,
    summaryText,
    stats: {
      bytes,
      lines,
      characters
    },
    previewTruncated,
    copyAllowed,
    copyByteLimit
  };
}
