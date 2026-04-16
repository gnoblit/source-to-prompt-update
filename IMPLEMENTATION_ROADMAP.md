# Implementation Roadmap

## Purpose

Translate the endpoint architecture in [ARCHITECTURE.md](/home/graham/projects/your-source-to-prompt.html/ARCHITECTURE.md:1) into an implementation plan that is:

- traceable to the current monolith
- rigorous about package boundaries
- sequenced to reduce regression risk
- explicit about what "done" means at each stage

This roadmap optimizes for the agreed endpoint:

- portable domain core
- separate application layer
- Tauri as the primary shell
- browser as a secondary shell
- `PromptBundle` as the canonical output artifact

Environment policy:

- WSL is the default development environment
- Linux and Windows desktop validation are tracked as separate Tauri verification targets
- desktop-readiness claims require host-native validation, not just WSL/browser success

Reference:

- [DEVELOPMENT_APPROACH.md](/home/graham/projects/your-source-to-prompt.html/DEVELOPMENT_APPROACH.md:1)
- [STATUS.md](/home/graham/projects/your-source-to-prompt.html/STATUS.md:1)

## Ground Rules

### Rule 1: The Current HTML App Is The Behavior Oracle

Until replacement behavior is tested and accepted, [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1) remains the reference implementation for:

- scan behavior
- selection behavior
- preset behavior
- transform behavior
- output formatting

### Rule 2: Package Boundaries Are Architectural Constraints

Allowed dependency direction:

1. `apps/*` may depend on `packages/application`, `packages/host-contracts`, and one or more host implementation packages.
2. `packages/application` may depend on `packages/core` and `packages/host-contracts`.
3. `packages/host-impl-*` may depend on `packages/host-contracts`.
4. `packages/core` must not depend on shells, hosts, or DOM/browser/Tauri APIs.

Forbidden dependency direction:

- `packages/core` -> `packages/application`
- `packages/core` -> any host implementation
- `packages/application` -> shell code
- shell code -> monolith globals

### Rule 3: The Internal Output Contract Is `PromptBundle`

No new implementation work should go straight from selected files to final plain text unless it is explicitly part of a renderer.

### Rule 4: Unsafe Transforms Must Stay Explicit

Heuristic comment removal is unsafe by definition. It must remain clearly labeled and never silently become part of a "safe" pipeline.

## Current Monolith Map

The current HTML file already contains most of the future subsystems. The job is to separate them cleanly.

### Errors, diagnostics, persistence, loading, and browser capability handling

Source range:

- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:802)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1278)

Target packages:

- `packages/core/src/errors/*`
- `packages/application/src/state/*`
- `packages/host-contracts/src/*`
- `packages/host-impl-browser/src/*`

### File type detection, ignore handling, virtual tree foundations, scan, selection math

Source range:

- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1280)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1842)

Target packages:

- `packages/core/src/file-types/*`
- `packages/core/src/ignore/*`
- `packages/core/src/scan/*`
- `packages/core/src/selection/*`
- `packages/application/src/selectors/*`

### Presets

Source range:

- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1844)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1990)

Target packages:

- `packages/core/src/profiles/*`
- `packages/application/src/use-cases/*`
- `packages/host-contracts/src/persistence-host.js`
- `packages/host-impl-browser/src/browser-persistence-host.js`

### Repository selection, restore, tree events, refresh orchestration

Source range:

- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:1992)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:2108)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:2711)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:2769)

Target packages:

- `packages/application/src/use-cases/*`
- `packages/host-contracts/src/repository-host.js`
- `packages/host-impl-browser/src/browser-repository-host.js`
- `apps/browser/src/*`
- `apps/tauri/src/*`

### Output assembly, transforms, worker orchestration, copy/download/save

Source range:

- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:2110)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:2707)

Target packages:

- `packages/core/src/models/prompt-bundle.js`
- `packages/core/src/output/*`
- `packages/core/src/transforms/*`
- `packages/host-contracts/src/task-host.js`
- `packages/host-contracts/src/output-host.js`
- `packages/host-impl-browser/src/browser-task-host.js`
- `packages/host-impl-browser/src/browser-output-host.js`

### Filtering, file-type bulk selection, app-level diagnostics hooks

Source range:

- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:2770)
- [your-source-to-prompt.html](/home/graham/projects/your-source-to-prompt.html/your-source-to-prompt.html:2908)

Target packages:

- `packages/core/src/selection/filter-engine.js`
- `packages/application/src/selectors/*`
- shell-level UI modules

## Deliverables By Package

### `packages/core`

Must eventually contain:

- canonical models
- ignore engine
- file-type rules
- scan engine
- selection engine
- filter engine
- transform engine
- output engine
- profiles engine
- error normalization

Definition of done:

- no DOM, browser, or Tauri APIs
- deterministic tests for all major workflows
- all data structures are explicit and serializable where appropriate

### `packages/application`

Must eventually contain:

- app state
- selectors
- use-case orchestration
- workflow status transitions

Definition of done:

- workflows are host-driven through interfaces, not direct API calls
- shell code only calls use cases and selectors

### `packages/host-contracts`

Must eventually contain:

- repository contract
- persistence contract
- task contract
- output contract
- diagnostics contract

Definition of done:

- contracts are specific enough that both browser and Tauri can implement them without leaking host assumptions into the core

### `packages/host-impl-browser`

Must eventually contain:

- browser repository access
- browser persistence
- browser worker execution
- browser output actions
- browser diagnostics hooks

Definition of done:

- all browser-specific APIs are isolated here

### `apps/browser`

Must eventually contain:

- browser shell bootstrapping
- browser UI composition
- browser-specific rendering and viewport logic

Definition of done:

- shell depends on application + host contracts, not monolith internals

### `apps/tauri`

Must eventually contain:

- Tauri shell bootstrapping
- Tauri-specific host implementations where needed
- desktop packaging and integration glue

Definition of done:

- Tauri can run the same use cases on the same core/application packages

## Milestones

### Milestone 1: Repository Structure And Contracts

Goal:

- make the endpoint architecture real in the repo

Deliverables:

- workspace root
- package skeletons
- contract files
- canonical model files
- implementation roadmap

Acceptance criteria:

- directory layout matches the endpoint architecture
- the repo has named places for every major subsystem

### Milestone 2: Core Models And Error Contracts

Goal:

- establish stable data contracts before behavior extraction

Deliverables:

- `RepositorySnapshot`
- `RepositoryIndex`
- `SelectionSet`
- `Profile`
- `TransformPlan`
- `PromptBundle`
- error normalization module

Acceptance criteria:

- models are explicit and documented
- tests can be written against them without any host

### Milestone 3: Scan Engine Extraction

Goal:

- move scan logic out of the monolith while preserving behavior

Deliverables:

- traversal logic
- ignore matching
- text-file detection
- progress events
- repository index builder

Acceptance criteria:

- scan behavior on fixture repos matches the monolith
- partial failure handling is preserved

### Milestone 4: Selection And Filter Extraction

Goal:

- isolate the highest-regression interaction logic

Deliverables:

- selection engine
- filter engine
- folder count derivation
- restore reconciliation

Acceptance criteria:

- folder checkbox semantics match the monolith
- filter + collapsed folder behavior is preserved or intentionally changed with tests

### Milestone 5: Output And Transform Extraction

Goal:

- replace ad hoc combine logic with `TransformPlan` and `PromptBundle`

Deliverables:

- transform planner
- safe/unsafe transform split
- prompt bundle builder
- text renderer
- stats renderer inputs

Acceptance criteria:

- combined output fixtures match expected formatting
- unsafe transforms remain opt-in

### Milestone 6: Browser Host And Shell

Goal:

- make the browser implementation depend on the new layers

Deliverables:

- browser host adapters
- browser shell boot path
- browser rendering path

Acceptance criteria:

- browser shell no longer depends on monolith globals
- current browser functionality remains usable

### Milestone 7: Tauri Shell

Goal:

- realize the primary endpoint product

Deliverables:

- Tauri app shell
- Tauri repository/output integration
- desktop packaging path

Acceptance criteria:

- primary workflows run in Tauri
- offline local execution is supported
- Linux desktop prerequisites and compile checks are documented and repeatable
- Windows desktop validation is planned as a distinct verification track

## Verification Matrix

For every milestone that extracts behavior, verify:

1. Repository selection and restore
2. Scan on small repo
3. Scan on large repo
4. Filter by path
5. Select all visible files
6. Toggle folder selection
7. Save and load profile
8. Refresh while preserving valid selections
9. Combine without transforms
10. Combine with unsafe transforms
11. Copy/export/save output

For Tauri milestones, verify each applicable item separately on:

- Linux
- Windows

Do not treat WSL/browser validation as a substitute for native Windows validation.

## Critical Architectural Checks

Use this checklist during implementation reviews:

- Does this new code belong in core, application, host, or shell?
- Does any core code directly touch browser or Tauri APIs?
- Are we storing derived UI state as canonical state?
- Are we preserving the distinction between `PromptBundle` creation and final rendering?
- Are unsafe transforms clearly labeled and isolated?
- Are profile/preset behaviors preserved as real product functionality?

## Immediate Next Steps

1. Keep the current HTML file unchanged as the behavior oracle.
2. Land the workspace and package skeleton.
3. Implement canonical model modules first.
4. Write the first fixture-driven tests around scan, selection, and bundle assembly before extracting behavior.
5. Treat WSL as the default coding environment, but keep Linux and Windows Tauri validation as explicit separate tracks.
