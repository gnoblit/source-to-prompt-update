export const OUTPUT_PREVIEW_CHARACTER_LIMIT = 200_000;
export const OUTPUT_COPY_BYTE_LIMIT = 1_048_576;

function countLines(text) {
  if (!text) {
    return 0;
  }

  let lines = 1;
  let offset = 0;
  while ((offset = text.indexOf('\n', offset)) !== -1) {
    lines += 1;
    offset += 1;
  }
  return lines;
}

export function measureTextBytes(text = '') {
  const normalized = typeof text === 'string' ? text : String(text || '');
  let bytes = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const codePoint = normalized.codePointAt(index);

    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
      index += 1;
    }
  }

  return bytes;
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
