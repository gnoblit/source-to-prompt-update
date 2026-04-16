# Architecture Proposal

## Objective

Define the **optimal endpoint architecture** for `your-source-to-prompt.html`, not just the safest incremental refactor.

The target system should maximize:

- local trust and privacy
- reliable repository access
- offline operation
- maintainability
- correctness of core workflows
- future extensibility across hosts

This document treats migration as important, but secondary. The main question is:

**What system should this product ideally become?**

## Executive Summary

The optimal endpoint is:

1. A **portable domain core**
2. A distinct **application/use-case layer**
3. A **Tauri desktop shell** as the primary supported product
4. A **browser shell** as a secondary lightweight host
5. A structured **PromptBundle** output model rather than direct text-only assembly

This is the best long-term system because it combines:

- stable local filesystem access
- offline packaging
- environment-independent core logic
- a path to alternate shells without re-architecting the product again

The browser remains useful, but it should no longer define the product’s architecture.

## Architectural Decision

### Recommended Endpoint

Adopt a five-part system:

- **Domain core**
- **Application layer**
- **Host adapter layer**
- **Tauri shell**
- **Browser shell**

The primary supported product should be the Tauri desktop app.

The browser app should remain available as a secondary shell for low-friction usage, demos, and compatibility where browser-hosted local access is acceptable.

Development note:

- WSL is an acceptable primary authoring environment
- native Linux and native Windows remain separate desktop validation targets
- WSL success does not count as native Windows desktop validation

### Why Tauri Is The Right Primary Endpoint

For this product, the most important qualities are:

- trustworthy local execution
- stable folder and file access
- reduced platform permission friction
- offline packaging
- predictable dependency control

A browser shell is excellent for accessibility and simplicity, but it is structurally weaker on those exact dimensions. Browser APIs, permissions, restore behavior, and local capability support are all more fragile than a packaged desktop host.

If we are optimizing the endpoint rather than the migration comfort, Tauri is the better primary shell.

### Why This Is Not A Full Domain Rewrite

The core product logic remains portable.

The goal is not:

- rewrite the logic in a framework
- move everything into desktop-specific code
- abandon the browser completely

The goal is:

- keep the core stable and reusable
- move host-specific behavior to explicit adapters
- let shells compete on UX and runtime characteristics without owning the product logic

## System Architecture

## Layer 1: Domain Core

The domain core contains only environment-agnostic product logic.

It must not depend on:

- DOM APIs
- browser storage APIs
- `showDirectoryPicker`
- Tauri APIs
- clipboard APIs
- save/download APIs
- worker APIs directly

The domain core owns:

- repository traversal rules
- ignore matching
- text-file classification
- repository index modeling
- selection rules
- filter rules
- transform contracts
- output assembly rules
- error normalization rules

The domain core should be portable across:

- Tauri
- browser
- future CLI host

## Layer 2: Application Layer

The application layer coordinates use cases and workflow state.

This is distinct from the domain core.

It owns:

- scan workflow orchestration
- refresh workflow
- restore workflow
- combine workflow
- export workflow
- preset/profile workflow
- app state and selectors
- progress and status coordination

This separation matters because `state`, `actions`, and `selectors` are not pure domain concepts. They are application behavior and should not live inside the portable domain core.

## Layer 3: Host Adapter Layer

The host adapter layer implements environment-specific capabilities needed by the application layer and core.

Examples:

- repository access
- persistence
- background task execution
- output actions
- diagnostics sinks

Host adapters must be narrow, explicit, and replaceable.

## Layer 4: Shells

The shells are product-facing implementations.

### Primary Shell: Tauri

Responsibilities:

- desktop windowing and packaging
- local filesystem integration
- desktop save/export flows
- shell-level UX

### Secondary Shell: Browser

Responsibilities:

- browser-local UI
- File System Access API integration where supported
- lightweight distribution
- compatibility mode for users who prefer not to install a desktop app

Shells should contain presentation and orchestration glue, but not own domain rules.

## Architectural Principles

### 1. Portable Core, Replaceable Shells

The core logic should survive a shell change.

### 2. Canonical Models First

The system should represent repositories, selections, transforms, and outputs as explicit models before rendering them to UI or text.

### 3. Structured Output Before Text Output

The system should not jump directly from selected files to final plain text.

It should first build a structured artifact such as `PromptBundle`, then render that artifact to text or another export format.

### 4. Scan And Index Are First-Class

Scanning is not incidental implementation detail. It is one of the core engines of the product.

### 5. Transform Safety Must Be Explicit

The system must distinguish safe transforms from unsafe transforms in both architecture and user-facing behavior.

### 6. Profiles Are Product Features

Saved presets and reusable working configurations are part of the product and should exist as a first-class subsystem, not as incidental UI state.

## Canonical Models

## `RepositorySnapshot`

Represents the host-level repository selection and scan result.

Fields should include:

- repository identity
- root metadata
- scan timestamp
- capabilities and limitations
- repository index reference
- scan diagnostics summary

## `RepositoryIndex`

Canonical normalized representation of repository contents.

Responsibilities:

- entries by path
- ancestor and descendant relationships
- directory membership
- text-file metadata
- ignore outcomes
- refresh reconciliation support

The UI tree must be derived from this index.

## `SelectionSet`

Represents user intent about what content is selected.

Responsibilities:

- direct file selection
- folder-derived selection
- filtered selection tracking
- restoration after refresh

## `Profile`

Represents a saved working configuration.

Should include:

- selected paths or path rules
- transform settings
- prompt framing options
- output options
- optional host-specific restore hints

Profiles should be treated as durable product data, not merely dropdown UI state.

## `TransformPlan`

Represents the transform strategy chosen for a combine operation.

Should include:

- enabled transforms
- safety classification
- execution strategy
- background execution requirements
- warnings and limitations

## `PromptBundle`

This is the most important missing abstraction in the prior plans.

`PromptBundle` is the structured output artifact produced before rendering to plain text.

It should contain:

- metadata
- selected file list
- repository structure summary
- prompt framing sections
- transformed file contents
- transform provenance
- warnings
- output stats

Then separate renderers can produce:

- plain text bundle
- JSON bundle
- future export formats

This model makes the system easier to test, easier to diagnose, and less tightly coupled to one output format.

## Core Subsystems

## Scan Engine

The scan engine is a first-class domain subsystem.

Responsibilities:

- traversal planning
- ignore application
- metadata policy
- text-file detection
- progress event emission
- cancellation cooperation
- partial failure handling
- repository index construction

The scan engine must not render UI rows.

## Selection Engine

Responsibilities:

- file selection logic
- folder selection logic
- filter-aware selection math
- restore logic after refresh
- tally derivation support

This subsystem should be heavily tested.

## Filter Engine

Responsibilities:

- query normalization
- matching rules
- visible path derivation
- ancestor inclusion behavior

## Transform Engine

Responsibilities:

- transform planning
- transform safety classification
- selecting background or foreground execution
- coordinating result metadata

Safety classes:

- **safe**: semantics-preserving transforms
- **unsafe**: heuristic transforms that may alter meaning
- **language-aware**: parser-backed transforms for supported languages

Unsafe transforms should be opt-in by default.

## Output Engine

Responsibilities:

- build `PromptBundle`
- validate completeness of bundle contents
- compute stats and warnings
- render final text output
- support alternate output renderers

## Profiles Engine

Responsibilities:

- save profiles
- load profiles
- validate profile compatibility
- reconcile missing files after refresh

## Host Contracts

The contracts below should be richer than simple helper functions.

## `RepositoryHost`

Responsibilities:

- choose or restore a repository
- enumerate directory entries asynchronously
- expose file and directory metadata
- read text content
- support cancellation signals
- surface capability and permission errors explicitly
- report partial traversal failures

This contract must support the needs of the scan engine directly.

## `PersistenceHost`

Responsibilities:

- persist profiles
- persist lightweight UI state
- persist host-specific repository restore hints
- restore stored values with validation

## `TaskHost`

Responsibilities:

- execute background transform tasks
- report progress
- support cancellation
- support timeout behavior
- fall back to inline execution when necessary

## `OutputHost`

Responsibilities:

- copy output
- save output
- export structured bundle

## `DiagnosticsHost`

Responsibilities:

- append structured diagnostics
- clear diagnostics
- export diagnostics

## Application Layer

The application layer should own use-case orchestration and state.

## Use Cases

The application layer should expose use cases such as:

- `selectRepository`
- `restoreRepository`
- `scanRepository`
- `refreshRepository`
- `toggleSelection`
- `toggleFolderSelection`
- `applyFilter`
- `saveProfile`
- `loadProfile`
- `combineSelection`
- `exportBundle`

## Application State

The application state should represent user intent and workflow progress.

Recommended top-level shape:

```js
{
  session: {
    host: 'tauri',
    capabilities: {}
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
    activeProfileId: null
  },
  options: {
    includePreamble: false,
    preambleMode: 'custom',
    customPreamble: '',
    includeGoal: false,
    goalText: '',
    transforms: {
      removeComments: false,
      minifyOutput: false
    }
  },
  output: {
    bundle: null,
    renderedText: '',
    fileName: 'combined_files.txt'
  },
  ui: {
    expandedFolders: new Set(),
    globalMessage: null
  },
  diagnostics: {
    entries: []
  }
}
```

Derived values should be computed rather than stored as primary state:

- visible rows
- visible folder counts
- selected folder counts
- total selected size
- known line totals
- combine readiness

## Shell Strategy

## Primary Product: Tauri Shell

The Tauri shell should be treated as the main endpoint.

Why:

- stronger local filesystem behavior
- fewer browser capability constraints
- fully offline packaging
- clearer trust model for users handling source code locally

The Tauri shell should implement the same contracts as the browser shell.

Development and validation policy:

- authoring may happen primarily in WSL
- Linux Tauri validation should happen against Linux desktop prerequisites
- Windows Tauri validation should happen on native Windows

Reference:

- [DEVELOPMENT_APPROACH.md](/home/graham/projects/your-source-to-prompt.html/DEVELOPMENT_APPROACH.md:1)

## Secondary Product: Browser Shell

The browser shell remains valuable for:

- quick usage
- zero-install workflows
- demos
- compatibility mode

But it should be explicitly secondary. It is a shell choice, not the architectural center.

## Future Product: CLI Shell

The CLI should remain a future possibility, not the current endpoint target.

It becomes attractive if:

- automation becomes core
- batch workflows matter
- parser-backed transforms expand significantly

## Candidate Architectures

### Option A: Portable Core + Application Layer + Tauri Primary

This is the recommended endpoint.

Pros:

- best product reliability
- best trust and offline story
- clean long-term layering
- browser and CLI remain possible later

Cons:

- somewhat more architectural work now
- desktop packaging becomes part of the roadmap

### Option B: Portable Core + Browser Primary

Viable, but not optimal.

Pros:

- lower immediate migration cost
- low-friction usage

Cons:

- weaker endpoint for local repo tooling
- more capability and permission fragility
- less aligned with the product’s strongest value proposition

### Option C: Browser SPA Rewrite

Not recommended as the main architectural move.

It may improve UI organization, but it does not solve the primary endpoint problem by itself.

## Target Repository Layout

```text
.
├── README.md
├── ARCHITECTURE.md
├── package.json
├── apps/
│   ├── tauri/
│   │   ├── src/
│   │   └── src-tauri/
│   └── browser/
│       └── src/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── models/
│   │   │   │   ├── repository-snapshot.js
│   │   │   │   ├── repository-index.js
│   │   │   │   ├── selection-set.js
│   │   │   │   ├── profile.js
│   │   │   │   ├── transform-plan.js
│   │   │   │   └── prompt-bundle.js
│   │   │   ├── ignore/
│   │   │   ├── file-types/
│   │   │   ├── scan/
│   │   │   ├── selection/
│   │   │   ├── transforms/
│   │   │   ├── output/
│   │   │   ├── profiles/
│   │   │   └── errors/
│   ├── application/
│   │   ├── src/
│   │   │   ├── use-cases/
│   │   │   ├── state/
│   │   │   └── selectors/
│   ├── host-contracts/
│   │   └── src/
│   │       ├── repository-host.js
│   │       ├── persistence-host.js
│   │       ├── task-host.js
│   │       ├── output-host.js
│   │       └── diagnostics-host.js
│   └── host-impl-browser/
│       └── src/
├── tests/
│   ├── core/
│   ├── application/
│   └── integration/
└── dist/
```

This layout makes the endpoint explicit:

- reusable core packages
- reusable application layer
- independent shells

## Data Flow

## Select And Scan

1. Shell requests repository selection through `RepositoryHost`.
2. Application layer starts `scanRepository`.
3. Core scan engine traverses and returns `RepositorySnapshot` plus `RepositoryIndex`.
4. Application state updates.
5. Shell renders derived views.

## Refresh

1. Application snapshots selection and profile state.
2. Core scan engine rebuilds the repository view.
3. Selection engine reconciles existing choices.
4. Application updates state.
5. Shell re-renders.

## Combine

1. Application resolves selected entries from `RepositoryIndex`.
2. `RepositoryHost` reads content.
3. Core transform engine builds `TransformPlan`.
4. `TaskHost` executes transforms if needed.
5. Core output engine builds `PromptBundle`.
6. Output renderer produces final text.
7. `OutputHost` copies or saves the result.

## Non-Functional Requirements

### Performance

Must preserve:

- virtualized tree behavior
- responsive filtering
- chunked scanning
- background transforms

Must improve:

- separation between scanning and rendering
- deterministic indexing behavior

### Reliability

Must improve:

- offline operation
- repository access stability
- easier recovery from partial scan failures
- clearer transform fallback behavior

### Security And Trust

Must improve:

- fully local normal operation
- explicit transform warnings
- explicit output provenance

### Testability

Must improve:

- domain tests independent of shell
- application workflow tests
- shell integration tests

## Migration Strategy

The endpoint above is the target. Migration should serve it directly.

## Phase 0: Freeze Existing Behavior

Goal:

- capture current user-visible behavior and regressions to avoid

Actions:

- document existing flows
- define fixture repositories
- capture combine-output fixtures

## Phase 1: Create Contracts And Canonical Models

Goal:

- define the target system’s real boundaries before moving code

Actions:

- define host contracts
- define `RepositorySnapshot`
- define `RepositoryIndex`
- define `Profile`
- define `TransformPlan`
- define `PromptBundle`

## Phase 2: Extract Core Engines

Goal:

- move domain logic into the portable core

Priority:

- ignore engine
- file-type rules
- scan engine
- selection engine
- filter engine
- output engine
- profiles engine

## Phase 3: Extract Application Layer

Goal:

- move workflows, state, and selectors out of the monolith

Priority:

- scan workflow
- refresh workflow
- restore workflow
- combine workflow
- profile workflow

## Phase 4: Implement Browser Host And Browser Shell

Goal:

- preserve the current product experience while proving the contracts

This is an intermediate proving shell, not the final architectural endpoint.

## Phase 5: Implement Tauri Host And Tauri Shell

Goal:

- realize the primary endpoint product

Priority:

- repository access
- save/export
- diagnostics
- packaging
- offline operation

## Phase 6: Make PromptBundle The Primary Output Artifact

Goal:

- remove direct dependence on final text as the internal output format

Actions:

- build structured bundle first
- add text renderer
- add JSON export path

## Phase 7: Reassess Secondary Shells

Goal:

- decide how much to invest in browser and CLI shells after the desktop product is stable

## Rewrite Triggers

The architecture should be considered successful if shell changes do not require core redesign.

The following may justify shell-level rewrites:

- browser UI complexity grows enough to justify a framework shell
- Tauri shell needs a different desktop UX architecture
- CLI productization becomes important

These should not trigger a redesign of the domain core.

## Risks And Mitigations

### Risk: We Under-Specify Contracts

Mitigation:

- define contracts from scan and combine requirements, not from convenience wrappers

### Risk: We Carry Browser Assumptions Into The Core

Mitigation:

- reject direct browser-specific APIs in core and application packages

### Risk: We Never Reach The Better Endpoint

Mitigation:

- treat Tauri as an explicit planned endpoint, not a distant possibility

### Risk: PromptBundle Adds Complexity

Mitigation:

- keep the model small and focused on current product needs
- use renderers to keep export formats separate from bundle assembly

## Testing Strategy

Priority tests:

- scan engine behavior
- repository index correctness
- selection and filter behavior
- profile persistence logic
- transform planning and safety classification
- prompt bundle assembly
- text rendering from prompt bundle

Integration tests:

- browser shell smoke tests
- Tauri shell smoke tests
- host contract conformance tests

## Recommendation

Build toward this endpoint:

- **portable domain core**
- **separate application layer**
- **Tauri as the primary shell**
- **browser as a secondary shell**
- **PromptBundle as the canonical output artifact**

That is the architecture most aligned with the product’s real value: trusted local source processing with reliable repository access and room to grow without redoing the system again.
