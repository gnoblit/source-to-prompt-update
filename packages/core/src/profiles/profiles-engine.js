import { createProfile } from '../models/profile.js';

function sanitizeProfileName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function generateProfileId(name) {
  const normalized = sanitizeProfileName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `profile-${Date.now()}`;
}

export function createProfileSnapshot({ name, state, repositorySnapshot } = {}) {
  const profileName = sanitizeProfileName(name);
  if (!profileName) {
    throw new TypeError('Profile name is required');
  }

  const now = new Date().toISOString();
  return createProfile({
    id: generateProfileId(profileName),
    name: profileName,
    selectedPaths: Array.from(state?.selection?.selectedPaths || []).sort((left, right) =>
      left.localeCompare(right)
    ),
    promptOptions: {
      includePreamble: state?.options?.includePreamble === true,
      preambleMode: state?.options?.preambleMode || 'custom',
      customPreamble: state?.options?.customPreamble || '',
      includeGoal: state?.options?.includeGoal === true,
      goalText: state?.options?.goalText || ''
    },
    transformOptions: {
      removeComments: state?.options?.transforms?.removeComments === true,
      minifyOutput: state?.options?.transforms?.minifyOutput === true
    },
    outputOptions: {
      fileName: state?.output?.fileName || 'combined_files.txt'
    },
    restoreHints: {
      repositoryId: repositorySnapshot?.repositoryId || null,
      rootName: repositorySnapshot?.rootName || ''
    },
    createdAt: now,
    updatedAt: now
  });
}

export function normalizeProfiles(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((profile) => createProfile(profile))
    .filter((profile) => profile.id && profile.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function upsertProfile(profiles, profile) {
  const normalizedProfiles = normalizeProfiles(profiles);
  const normalizedProfile = createProfile(profile);
  const existingIndex = normalizedProfiles.findIndex((entry) => entry.id === normalizedProfile.id);

  if (existingIndex >= 0) {
    const previous = normalizedProfiles[existingIndex];
    normalizedProfiles[existingIndex] = createProfile({
      ...previous,
      ...normalizedProfile,
      createdAt: previous.createdAt || normalizedProfile.createdAt,
      updatedAt: new Date().toISOString()
    });
  } else {
    normalizedProfiles.push(
      createProfile({
        ...normalizedProfile,
        updatedAt: new Date().toISOString()
      })
    );
  }

  return normalizedProfiles.sort((left, right) => left.name.localeCompare(right.name));
}

export function removeProfile(profiles, profileId) {
  return normalizeProfiles(profiles).filter((profile) => profile.id !== profileId);
}

export function findProfileById(profiles, profileId) {
  return normalizeProfiles(profiles).find((profile) => profile.id === profileId) || null;
}

export function applyProfileToState({ profile, state, repositoryIndex } = {}) {
  const normalizedProfile = createProfile(profile);
  const availablePaths = new Set(repositoryIndex?.textFilesByPath?.keys?.() || []);
  const selectedPaths = new Set();
  const missingPaths = [];

  for (const path of normalizedProfile.selectedPaths) {
    if (availablePaths.has(path)) {
      selectedPaths.add(path);
    } else {
      missingPaths.push(path);
    }
  }

  return {
    nextState: {
      ...state,
      selection: {
        ...state.selection,
        selectedPaths,
        filterSelectedPaths: new Set()
      },
      options: {
        ...state.options,
        includePreamble: normalizedProfile.promptOptions.includePreamble === true,
        preambleMode: normalizedProfile.promptOptions.preambleMode || 'custom',
        customPreamble: normalizedProfile.promptOptions.customPreamble || '',
        includeGoal: normalizedProfile.promptOptions.includeGoal === true,
        goalText: normalizedProfile.promptOptions.goalText || '',
        transforms: {
          removeComments: normalizedProfile.transformOptions.removeComments === true,
          minifyOutput: normalizedProfile.transformOptions.minifyOutput === true
        }
      },
      output: {
        ...state.output,
        fileName: normalizedProfile.outputOptions.fileName || state.output.fileName
      },
      profile: {
        ...state.profile,
        activeProfileId: normalizedProfile.id
      }
    },
    missingPaths
  };
}
