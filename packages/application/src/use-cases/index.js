import { buildPromptBundle, renderPromptBundleText } from '../../../core/src/output/output-engine.js';
import { normalizeError } from '../../../core/src/errors/normalize-error.js';
import { scanRepository } from '../../../core/src/scan/scan-engine.js';
import { reconcileSelectedPaths } from '../../../core/src/selection/selection-engine.js';
import {
  buildTransformPlan,
  buildTransformResult
} from '../../../core/src/transforms/transform-engine.js';
import { assertRepositoryHost } from '../../../host-contracts/src/repository-host.js';
import { assertTaskHost } from '../../../host-contracts/src/task-host.js';
import { BUILD_TRANSFORM_RESULT_TASK } from '../../../host-contracts/src/task-types.js';
import { cloneAppState, createAppState } from '../state/create-app-state.js';

function ensureState(state) {
  return state ? cloneAppState(state) : createAppState();
}

function getAvailableTextPaths(index) {
  return new Set(index?.textFilesByPath?.keys?.() || []);
}

function hasEnabledTransforms(options) {
  const transforms = options?.transforms || {};
  return transforms.removeComments === true || transforms.minifyOutput === true;
}

export async function scanSelectedRepository({
  state,
  repositoryHost,
  rootHandle,
  host = 'unknown',
  onProgress
} = {}) {
  const nextState = ensureState(state);
  const validatedHost = assertRepositoryHost(repositoryHost);

  const result = await scanRepository({
    rootHandle,
    host: validatedHost,
    onProgress: async (payload) => {
      nextState.repository.scanStatus = {
        phase: payload.phase,
        progress: payload,
        unreadableEntries: nextState.repository.scanStatus.unreadableEntries
      };
      if (typeof onProgress === 'function') {
        await onProgress(payload);
      }
    }
  });

  nextState.session.host = host;
  nextState.session.repositoryHandle = rootHandle;
  nextState.session.capabilities = { ...(result.snapshot.capabilities || {}) };
  nextState.repository.snapshot = result.snapshot;
  nextState.repository.scanStatus = {
    phase: 'complete',
    progress: null,
    unreadableEntries: result.diagnosticsSummary.unreadableEntries
  };

  return {
    nextState,
    result
  };
}

export async function selectRepository({
  state,
  repositoryHost,
  host = 'unknown',
  onProgress
} = {}) {
  const validatedHost = assertRepositoryHost(repositoryHost);
  const rootHandle = await validatedHost.selectRepository();

  return scanSelectedRepository({
    state,
    repositoryHost: validatedHost,
    rootHandle,
    host,
    onProgress
  });
}

export async function refreshRepository({
  state,
  repositoryHost,
  onProgress
} = {}) {
  const nextState = ensureState(state);
  const validatedHost = assertRepositoryHost(repositoryHost);
  const rootHandle = nextState.session.repositoryHandle;

  if (!rootHandle) {
    throw new TypeError('refreshRepository requires a repository handle in application state');
  }

  const previousSelectedPaths = new Set(nextState.selection.selectedPaths);
  const previousFilterSelectedPaths = new Set(nextState.selection.filterSelectedPaths);

  const scanOutcome = await scanSelectedRepository({
    state: nextState,
    repositoryHost: validatedHost,
    rootHandle,
    host: nextState.session.host,
    onProgress
  });

  const refreshedState = scanOutcome.nextState;
  const availablePaths = getAvailableTextPaths(refreshedState.repository.snapshot.index);

  refreshedState.selection.selectedPaths = reconcileSelectedPaths({
    selectedPaths: previousSelectedPaths,
    availablePaths
  });
  refreshedState.selection.filterSelectedPaths = reconcileSelectedPaths({
    selectedPaths: previousFilterSelectedPaths,
    availablePaths
  });

  return {
    nextState: refreshedState,
    result: scanOutcome.result
  };
}

export async function combineSelection({
  state,
  repositoryHost,
  taskHost = null
} = {}) {
  const nextState = ensureState(state);
  const validatedHost = assertRepositoryHost(repositoryHost);
  const rootHandle = nextState.session.repositoryHandle;
  const snapshot = nextState.repository.snapshot;

  if (!rootHandle || !snapshot || !snapshot.index) {
    throw new TypeError('combineSelection requires a scanned repository in application state');
  }

  const selectedPaths = Array.from(nextState.selection.selectedPaths).sort((left, right) =>
    left.localeCompare(right)
  );
  if (selectedPaths.length === 0) {
    throw new Error('combineSelection requires at least one selected text file');
  }

  const selectedFiles = [];
  for (const path of selectedPaths) {
    const entry = snapshot.index.textFilesByPath.get(path);
    if (!entry) {
      continue;
    }

    const fileHandle = await validatedHost.resolvePath(rootHandle, path);
    const rawContent = await validatedHost.readTextFile(fileHandle);
    const content = rawContent.trim();
    const lines = content.split('\n').length;

    selectedFiles.push({
      path,
      content,
      size: entry.size || 0,
      lines
    });
  }

  const transformOptions = {
    removeComments: nextState.options.transforms?.removeComments === true,
    minifyOutput: nextState.options.transforms?.minifyOutput === true
  };
  const transformPayload = {
    selectedFiles,
    options: transformOptions
  };
  const transformPlan = buildTransformPlan(transformPayload);
  let transformExecution = {
    mode: 'inline',
    requestedStrategy: transformPlan.executionStrategy,
    usedTaskHost: false,
    fallbackUsed: false,
    taskType: null
  };

  let transformOutcome;
  if (hasEnabledTransforms(nextState.options)) {
    if (taskHost) {
      const validatedTaskHost = assertTaskHost(taskHost);
      transformExecution.usedTaskHost = true;

      if (transformPlan.executionStrategy === 'background-preferred') {
        try {
          transformOutcome = await validatedTaskHost.runTask({
            taskType: BUILD_TRANSFORM_RESULT_TASK,
            payload: transformPayload
          });
          transformExecution = {
            mode: 'background',
            requestedStrategy: transformPlan.executionStrategy,
            usedTaskHost: true,
            fallbackUsed: false,
            taskType: BUILD_TRANSFORM_RESULT_TASK
          };
        } catch {
          transformOutcome = await validatedTaskHost.runInlineTask(
            buildTransformResult,
            transformPayload
          );
          transformExecution = {
            mode: 'inline',
            requestedStrategy: transformPlan.executionStrategy,
            usedTaskHost: true,
            fallbackUsed: true,
            taskType: BUILD_TRANSFORM_RESULT_TASK
          };
        }
      } else {
        transformOutcome = await validatedTaskHost.runInlineTask(
          buildTransformResult,
          transformPayload
        );
        transformExecution = {
          mode: 'inline',
          requestedStrategy: transformPlan.executionStrategy,
          usedTaskHost: true,
          fallbackUsed: false,
          taskType: null
        };
      }
    } else {
      transformOutcome = await buildTransformResult(transformPayload);
    }
  } else {
    transformOutcome = await buildTransformResult(transformPayload);
  }

  const bundle = buildPromptBundle({
    selectedFiles: transformOutcome.transformedFiles,
    options: {
      includePreamble: nextState.options.includePreamble,
      customPreamble: nextState.options.customPreamble,
      includeGoal: nextState.options.includeGoal,
      goalText: nextState.options.goalText
    },
    metadata: {
      repositoryId: snapshot.repositoryId,
      rootName: snapshot.rootName
    },
    transformProvenance: transformOutcome.transformProvenance,
    warnings: transformOutcome.warnings,
    stats: transformOutcome.stats
  });

  const renderedText = renderPromptBundleText(bundle);
  nextState.output.bundle = bundle;
  nextState.output.renderedText = renderedText;

  return {
    nextState,
    bundle,
    renderedText,
    transformPlan: transformOutcome.plan,
    transformExecution
  };
}

export function normalizeUseCaseError(error, context) {
  return normalizeError(error, context);
}
