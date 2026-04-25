import { createEmptyOutputState } from './output-state.js';

function cloneOutputState(output) {
  if (!output) {
    return createEmptyOutputState();
  }

  return {
    ...output,
    fileName: output.fileName || 'combined_files.txt'
  };
}

export function createAppState() {
  return {
    session: {
      host: 'unknown',
      capabilities: {},
      repositoryHandle: null
    },
    repository: {
      snapshot: null,
      scanStatus: {
        phase: 'idle',
        progress: null,
        unreadableEntries: 0
      }
    },
    selection: {
      selectedPaths: new Set(),
      filterSelectedPaths: new Set()
    },
    filter: {
      query: '',
      mode: 'path'
    },
    profile: {
      activeProfileId: null,
      savedProfiles: []
    },
    options: {
      includePreamble: false,
      preambleMode: 'custom',
      customPreamble: '',
      includeGoal: false,
      goalText: '',
      ignorePatterns: '',
      guardrails: {
        warningByteLimit: 512 * 1024,
        confirmationByteLimit: 2 * 1024 * 1024
      },
      transforms: {
        removeComments: false,
        minifyOutput: false
      }
    },
    output: createEmptyOutputState(),
    ui: {
      expandedFolders: new Set(),
      globalMessage: null,
      activeTask: null
    },
    diagnostics: {
      entries: []
    }
  };
}

export function cloneAppState(state) {
  return {
    session: {
      ...(state.session || {}),
      capabilities: { ...(state.session?.capabilities || {}) }
    },
    repository: {
      snapshot: state.repository?.snapshot || null,
      scanStatus: {
        ...(state.repository?.scanStatus || {
          phase: 'idle',
          progress: null,
          unreadableEntries: 0
        })
      }
    },
    selection: {
      selectedPaths: new Set(state.selection?.selectedPaths || []),
      filterSelectedPaths: new Set(state.selection?.filterSelectedPaths || [])
    },
    filter: {
      ...(state.filter || { query: '', mode: 'path' })
    },
    profile: {
      ...(state.profile || { activeProfileId: null, savedProfiles: [] }),
      savedProfiles: Array.isArray(state.profile?.savedProfiles)
        ? state.profile.savedProfiles.map((profile) => ({ ...profile }))
        : []
    },
    options: {
      ...(state.options || {}),
      guardrails: {
        warningByteLimit:
          typeof state.options?.guardrails?.warningByteLimit === 'number'
            ? state.options.guardrails.warningByteLimit
            : 512 * 1024,
        confirmationByteLimit:
          typeof state.options?.guardrails?.confirmationByteLimit === 'number'
            ? state.options.guardrails.confirmationByteLimit
            : 2 * 1024 * 1024
      },
      transforms: {
        ...(state.options?.transforms || {})
      }
    },
    output: cloneOutputState(state.output),
    ui: {
      ...(state.ui || {}),
      expandedFolders: new Set(state.ui?.expandedFolders || [])
    },
    diagnostics: {
      entries: Array.isArray(state.diagnostics?.entries) ? [...state.diagnostics.entries] : []
    }
  };
}
