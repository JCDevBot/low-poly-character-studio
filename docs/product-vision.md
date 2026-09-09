# Product Vision

## Purpose

Low Poly Character Studio is an image-to-character compiler and iterative capability authoring environment for producing usable, stylized 3D characters.

A user supplies one or more reference images, generates a model and rig, reviews what the system believes the character's functional anatomy can do, watches those inferred capabilities demonstrated, corrects the assumptions, reruns the affected behavior, and saves a validated reusable character asset. Saved assets can also be assembled into named, versioned packages that are testable locally before download.

The first supported model type is a stylized humanoid. The system must be designed so additional character morphologies can satisfy the same semantic capability contract without inheriting humanoid-specific bone or animation assumptions.

## Product experience direction

The Studio should present this capability as a polished creative product rather than exposing an internal pipeline console. The approved experience has three connected surfaces:

1. a landing page that proves the product with a Studio-created animated character demonstration and concise benefit tiles;
2. a sign-in or `Continue as guest` entry, with guest mode supporting the current local workflow;
3. a guided workspace with a permanent step navigator, dominant visual work surface, and context-sensitive inspector.

Users should see plain-language steps, one primary task at a time, and progressively disclosed technical detail. Internal terms such as StyleDNA, manifests, capability profiles, and stage artifacts remain available for reproducibility and advanced diagnostics but do not drive the primary navigation.

The canonical interaction, responsive, accessibility, completion, and migration specification is `docs/ui-product-experience.md`.

## Core user flow

1. **Choose a character model type**
   - Browse supported character morphologies and their declared capabilities.
   - Start with `humanoid/chibi-v1` for the initial implementation.

2. **Upload references**
   - Require one image for the minimum viable flow.
   - Allow optional front, side, back, and detail images for improved fidelity.
   - Normalize orientation, scale, crop, and image metadata.

3. **Analyze the references**
   - Detect or collect landmarks, silhouette, proportions, major colors, style characteristics, and observed semantic parts.
   - Produce versioned editable intermediate representations rather than one opaque generation result.

4. **Generate the model**
   - Select a model-type template and procedural generator.
   - Create low-poly topology and materials from the reference analysis.

5. **Rig and skin**
   - Apply the model type's standard rig strategy.
   - Generate or transfer skin weights.
   - Validate joints, hierarchy, transforms, and deformations.

6. **Infer functional anatomy and capabilities**
   - Identify likely core/root structures, locomotors, support contacts, manipulators/graspers, sensors, and articulators.
   - Derive a versioned capability profile with confidence, assumptions, evidence, and user-overridable values.
   - Keep semantic action intent independent from morphology-specific animation implementations.

7. **Demonstrate the inferred character**
   - Build a deterministic demo plan from the capability profile.
   - Exercise the required character vocabulary: neutral/setup, idle, walk, run, crouch, kneel, sit, jump, climb, fall, death, crawl, and object manipulation.
   - Surface missing prerequisites, uncertain assumptions, and failed demonstrations instead of hiding them.

8. **Review and refine capabilities**
   - Let the user correct role assignments, supported actions, contacts, manipulators, sensors, and other capability parameters without opening Blender.
   - Persist overrides separately from raw inference.
   - Rerun only the downstream stages invalidated by the edit until the user is satisfied.

9. **Save the individual asset**
   - Persist the selected character revision, capability profile, animation mappings, validation state, and reproducibility metadata.
   - Download the individual character independently as a portable GLB with embedded or sidecar capability metadata.

10. **Assemble packages**
   - Let users group selected saved asset revisions into named, versioned packages.
   - Record exact asset revisions, package configuration, dependencies, and compatibility metadata in a package manifest.

11. **Test and download packages**
   - Load the exact saved package revision in a local sandbox.
   - Exercise included character capabilities and package-level smoke tests before download.
   - Download the validated package as a portable manifest plus its referenced assets and metadata.

## Required character action contract

Every supported character model type targets a shared semantic action vocabulary. The implementation may differ by morphology, but the meaning remains stable:

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

The semantic contract describes intent and prerequisites. Concrete Blender actions, animation clip names, controllers, retargeting strategies, and procedural motion implementations remain model-type-specific.

## Initial vertical-slice foundation

The repository's existing first vertical slice remains the implementation foundation:

- Model type: `humanoid/chibi-v1`
- Input: one front reference image, with optional side and back references
- Output foundation: one low-poly humanoid `.glb`
- Geometry: recognizable proportions and major color regions
- Rig: standard humanoid skeleton with usable skin weights
- Existing animations: A-pose, idle, walk, and wave
- Experience: guided upload, analysis, generation, preview, validation, and download
- Reproducibility: build records model type, pipeline version, StyleDNA, and generation settings

The active product goal expands that foundation into capability inference, the full semantic action pack, iterative capability correction, reusable asset revisions, packages, and local package testing.

## Product principles

- **Useful from one image:** A single image must produce a coherent result, while the UI clearly communicates where additional views improve accuracy.
- **Stylized rather than photoreal:** The product optimizes for clean low-poly interpretation, not exact human reconstruction.
- **Deterministic and editable:** The same versioned inputs and settings should reproduce the same asset and capability contracts.
- **Semantic before implementation:** User-facing capability intent is stable even when different model types use different rigs or motion implementations.
- **Inference is reviewable:** Machine assumptions carry confidence and evidence and can be corrected by the user.
- **Model-type extensibility:** Shared pipeline stages operate through model type contracts and capability declarations.
- **Portable output:** Exported GLBs and package manifests should work without repository-specific runtime code where practical.
- **Independent assets, composable packages:** An asset remains usable on its own even when included in multiple packages.
- **Test what will ship:** Local package testing uses the same saved package revision that will be downloaded.
- **Transparent limitations:** The application exposes confidence, assumptions, unsupported features, stale validation, and failures.
- **Guided rather than tool-first:** A first-time user should always understand the current step and next action without learning pipeline terminology.
- **Visual work surface first:** References and generated characters receive the largest usable region, and every required image or model region remains reachable.

## Initial non-goals

- Photorealistic reconstruction
- Film-quality facial rigs
- Cloth, hair, or fluid simulation
- Arbitrary production-ready topology from every possible image
- Automatic support for every body plan before the character capability contract is stable
- Networked multiplayer or a complete game engine inside the package test sandbox
- Cloud-scale rendering or paid production infrastructure before the local pipeline works end to end
- Billing and team workspaces before the core authoring, asset, and package workflows are coherent

## Success criteria

The product direction is successful when a first-time user can upload a character image, generate and rig a recognizable low-poly character, understand and correct the system's inferred functional anatomy, demonstrate the required semantic actions, save the accepted character independently, combine chosen saved assets into a package, locally test the exact package revision, and download portable reproducible outputs without using Blender directly.
