# Architecture Direction

## System shape

The product is a pipeline-oriented character authoring application with six major runtime surfaces:

1. **Studio UI**: uploads references, selects a model type, edits StyleDNA and capability data, previews progress/results, manages saved assets/packages, runs demos, and downloads outputs.
2. **Job API**: validates requests, stores job state and revisions, invokes pipeline stages, and serves generated artifacts.
3. **Asset compiler**: runs image analysis, procedural modeling, rigging, animation, validation, and export.
4. **Capability layer**: infers functional anatomy, produces editable capability profiles, maps semantic actions to model-type implementations, and generates deterministic demo plans.
5. **Model type registry**: declares supported character morphologies and supplies their analysis, generation, rigging, capability, animation, and validation implementations.
6. **Asset/package store**: preserves immutable asset revisions and versioned package manifests that reference exact asset revisions for local testing and export.

The existing React/Vite studio, Express API, Blender scripts, StyleDNA work, build manifests, and GLB validation are the starting point. New capability and package behavior should extend those contracts rather than create a parallel application.

## Character build pipeline

Every character build advances through explicit, persisted stages:

1. `ingest`
2. `analyze`
3. `model`
4. `rig`
5. `capability`
6. `animate`
7. `demo`
8. `validate`
9. `export`

Each stage receives a versioned job manifest and writes versioned outputs. A failed stage must record an actionable error and preserve prior outputs for inspection.

A build should be resumable from the first incomplete or invalidated stage. Changing an upstream input invalidates downstream outputs. Capability edits should normally invalidate `animate`, `demo`, `validate`, and `export` without rebuilding geometry unless the edit changes a structural prerequisite that requires a new model or rig.

## Capability contract

Character model types implement a shared semantic capability contract rather than exposing only implementation-specific Blender clips.

The baseline semantic action vocabulary is versioned and includes:

- neutral/setup
- idle
- walk
- run
- crouch
- kneel
- sit
- jump
- climb
- fall
- death
- crawl
- object manipulation

Semantic action IDs describe user-facing intent. A model type maps those IDs to morphology-specific animation clips, controllers, procedural motion, or retargeting implementations.

Expected semantic parts may declare functional roles such as:

- core/root
- locomotor
- support/contact
- manipulator
- grasper
- sensor
- articulator
- presentation-only

The capability inference stage consumes the semantic part graph plus generated rig/geometry metadata and emits a versioned capability profile. Each inferred value records confidence or deterministic certainty, assumptions/evidence, and whether a user override supersedes the raw inference.

## Capability demo plans

A demo plan is a persisted declarative artifact derived from one capability-profile revision. It identifies the semantic actions to run, their order, prerequisites, fixtures, and expected outcomes.

Fixtures may include floor/contact surfaces, a seat, climb surface or ledge, and a graspable object. The browser preview and Blender review tooling consume the same semantic plan through model-type-specific implementations.

The demo plan must not hard-code Studio UI behavior to concrete Blender action names.

## Model type registry

Model types should be discoverable through a registry rather than hard-coded UI conditionals. A character model type owns its analysis schema, generator, rig, functional-part declarations, capability mapping, semantic-action implementations, validation rules, examples, and documentation.

Recommended target structure:

```text
packages/
  pipeline-core/
  model-types/
    humanoid/
      chibi-v1/
        manifest.json
        schema/
        analysis/
        modeling/
        rigging/
        capabilities/
        animations/
        validation/
        examples/
  capability-core/
  asset-compiler/
  glb-export/
  shared/
```

The current Blender implementation can remain in `packages/asset-compiler` while the registry contract evolves. Files should be moved only when a focused issue requires it.

## Model type manifest

Each character model type exposes a machine-readable manifest similar to:

```json
{
  "id": "humanoid/chibi-v1",
  "name": "Chibi Humanoid",
  "version": "1.0.0",
  "referenceSlots": [
    { "id": "front", "required": true },
    { "id": "side", "required": false },
    { "id": "back", "required": false }
  ],
  "capabilities": {
    "rigged": true,
    "animated": true,
    "materials": true
  },
  "characterCapabilities": {
    "contractVersion": "character-capability-contract/v1",
    "semanticActions": [
      { "id": "neutral", "required": true, "implementationId": "a-pose" },
      { "id": "idle", "required": true, "implementationId": "idle" },
      { "id": "walk", "required": true, "implementationId": "walk" },
      { "id": "run", "required": true, "implementationId": null }
    ]
  },
  "rig": "humanoid-basic-v1",
  "animations": ["a-pose", "idle", "walk", "wave"],
  "output": ["glb"]
}
```

The semantic-action list can declare required intent before its concrete implementation exists; validation of the capability contract and validation of a completed animation pack are separate concerns. The Studio uses the registry to display model types, reference slots, inferred functions, expected outputs, controls, and capability state. The API and compiler use the same registry to validate jobs and resolve stage implementations.

## Intermediate representations

### Build manifest

The build manifest records:

- job ID
- model type and version
- pipeline version
- input references and hashes
- generation settings
- capability contract/profile revision
- requested semantic actions and concrete mappings
- current stage and status
- produced artifacts and validation reports

### StyleDNA

StyleDNA remains the editable bridge between source images and procedural geometry generation. It contains normalized, model-type-aware visual and proportion information rather than Blender-specific coordinates alone.

### Capability profile

The capability profile is the editable bridge between generated structure and behavior. It records:

- semantic part and joint role assignments
- contacts/effectors
- manipulators and graspers
- sensors/orientation assumptions
- locomotion structures
- supported semantic actions and prerequisites
- confidence/certainty
- evidence and assumptions
- user overrides
- revision identity

Capability profiles must be versioned and validated against the selected model type's character capability contract.

### Demo plan

The demo plan records the exact capability-profile revision under test, ordered semantic actions, required fixtures, implementation mappings, expected contacts/states, and failure/skip reasons.

## Saved assets and packages

A completed character may be promoted from a build job into a saved **asset revision**. Asset identity and revision identity are separate: the same logical asset can have many immutable revisions.

A user-facing **package** is a versioned manifest that references exact saved asset revisions. It is not merely a transient ZIP operation.

A package manifest should record:

- package ID, revision, name, and schema version
- exact asset IDs and revision IDs
- asset capability/action metadata required for compatibility checks
- dependency and compatibility declarations
- package-level configuration
- validation and local-test evidence for the current package revision

An asset may belong to zero, one, or many packages without changing its independently downloadable revision.

## Local package sandbox

The Studio should be able to load the exact saved package manifest into a deterministic local/browser test scene. The sandbox validates runtime loading, identifier isolation, declared dependencies, and included character actions/demos using simple fixtures.

Package testing must use the same persisted package revision that will be downloaded. Unsaved editor state must not be represented as a passing package test.

## API direction

The current build routes should evolve toward resource-oriented APIs such as:

```text
POST /jobs
GET  /jobs/:id
POST /jobs/:id/run
POST /jobs/:id/cancel
GET  /jobs/:id/artifacts
GET  /model-types
GET  /model-types/:id
POST /assets
GET  /assets/:id
GET  /assets/:id/revisions/:revision
POST /packages
GET  /packages/:id
POST /packages/:id/test
GET  /packages/:id/artifacts
```

The first implementation may run locally and serially. Contracts should not assume Blender executes inside the web process long term.

## GLB and export contract

A completed character output must:

- be a valid glTF 2.0 binary asset
- use a predictable coordinate system and scale
- contain named mesh, material, skeleton, and animation objects
- have no missing external resources
- include build/capability metadata in glTF extras where practical
- provide a versioned sidecar manifest when richer capability data cannot be represented cleanly in glTF extras
- pass automated validation for the currently selected capability revision before becoming downloadable

A package export contains its versioned package manifest plus every referenced portable asset and required sidecar metadata.

## Testing strategy

Use layered checks:

- schema and contract unit tests without Blender
- deterministic fixture tests for StyleDNA and capability transformations
- capability-inference and demo-plan contract tests
- Blender smoke tests for each model type and semantic action pack
- GLB validation and metadata checks
- asset/package manifest validation tests
- local package sandbox smoke tests
- browser build and component tests
- golden-image or structural regression tests only where stable enough to be useful

GitHub-hosted CI should validate code that does not require Blender first. A dedicated Blender-capable runner or container can remain a separate task.

## Delivery direction

The repository uses two long-lived branches:

- `main`: default branch and production source of truth.
- `develop`: integration branch and source for ordinary feature and fix work.

Ordinary issue branches start from current `develop` and target `develop`. CI runs on pull requests targeting either long-lived branch and on pushes to both branches.

A green push to `develop` or `main` produces a versioned Studio build artifact containing the exact branch, commit, workflow run, and built distribution. This artifact is delivery evidence for that commit; it is not proof of public deployment.

Production promotion is a reviewed pull request from `develop` to `main`. CI validates the combined promotion result, but does not silently merge it or bypass human approval. Production hotfixes branch from `main`, target `main`, and must be reconciled back into `develop` before ordinary work resumes.

The full feature, integration, promotion, and hotfix contract is defined in `docs/delivery-workflow.md`.

Public hosting, production Blender workers, cloud storage, credentials, paid services, and multi-user package collaboration remain separate infrastructure decisions. They require explicit review and must define immutable artifact promotion, secrets, health checks, monitoring, and rollback or forward-fix behavior before deployment claims are made.
