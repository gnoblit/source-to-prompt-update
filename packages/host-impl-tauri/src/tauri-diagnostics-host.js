export function createTauriDiagnosticsHost({ maxEntries = 200, onChange } = {}) {
  const entries = [];

  function publish() {
    if (typeof onChange === 'function') {
      onChange([...entries]);
    }
  }

  return {
    append(entry) {
      entries.push(entry);
      if (entries.length > maxEntries) {
        entries.splice(0, entries.length - maxEntries);
      }
      publish();
    },

    clear() {
      entries.length = 0;
      publish();
    },

    exportEntries() {
      return [...entries];
    }
  };
}
