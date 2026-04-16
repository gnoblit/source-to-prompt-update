function getErrorName(error) {
  if (error && typeof error === 'object' && typeof error.name === 'string') {
    return error.name;
  }
  return 'Error';
}

function getErrorMessage(error) {
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message.trim();
  }
  if (typeof error === 'string') {
    return error.trim();
  }
  return '';
}

function isLikelyProtectedFolderMessage(message) {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('system') ||
    lowerMessage.includes('protected') ||
    lowerMessage.includes('not allowed') ||
    lowerMessage.includes('security') ||
    lowerMessage.includes('permission')
  );
}

export function normalizeError(error, context = 'operation') {
  const name = getErrorName(error);
  const message = getErrorMessage(error);
  const technical = message ? `${name}: ${message}` : name;

  if (name === 'AbortError') {
    const protectedFolder = isLikelyProtectedFolderMessage(message);
    return {
      context,
      name,
      message,
      technical,
      cancelled: true,
      userMessage: protectedFolder
        ? `${context} blocked because that folder or action appears to be protected by the host environment. Choose a project subfolder instead. (${technical})`
        : `${context} was canceled or blocked by the host environment. (${technical})`
    };
  }

  if (name === 'NotAllowedError') {
    return {
      context,
      name,
      message,
      technical,
      cancelled: false,
      userMessage: `${context} blocked by host or OS permissions. (${technical})`
    };
  }

  if (name === 'SecurityError') {
    return {
      context,
      name,
      message,
      technical,
      cancelled: false,
      userMessage: `${context} blocked by host security policy. (${technical})`
    };
  }

  if (
    name === 'TypeError' &&
    (message.includes('showDirectoryPicker') || context.toLowerCase().includes('folder'))
  ) {
    return {
      context,
      name,
      message,
      technical,
      cancelled: false,
      userMessage: `Folder selection is unavailable in this host or execution context. (${technical})`
    };
  }

  return {
    context,
    name,
    message,
    technical,
    cancelled: false,
    userMessage: message ? `${context} failed. (${technical})` : `${context} failed. (${name})`
  };
}
