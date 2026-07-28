# Product Vision

## Purpose

Low Poly Character Studio is an image-to-asset compiler for producing usable, stylized 3D assets.

A user supplies one or more reference images, chooses a supported model type, reviews or adjusts the inferred shape and style, runs an automated modeling and rigging pipeline, previews the result, and downloads a validated `.glb` containing the model, materials, skeleton, and basic animations.

The first supported model type is a stylized humanoid. The system must be designed so additional model types, such as animals, vehicles, props, buildings, or foliage, can be added without rewriting the shared application.

## Product experience direction

The Studio should present this capability as a polished creative product rather than exposing an internal pipeline console. The approved experience has three connected surfaces:

1. a landing page that proves the product with a Studio-created animated character demonstration and concise benefit tiles;
2. a sign-in or `Continue as guest` entry, with guest mode supporting the current local workflow;
3. a guided workspace with a permanent step navigator, dominant visual work surface, and context-sensitive inspector.

Users should see plain-language steps, one primary task at a time, and progressively disclosed technical detail. Internal terms such as StyleDNA, manifests, and stage artifacts remain available for reproducibility and advanced diagnostics but do not drive the primary navigation.

The canonical interaction, responsive, accessibility, completion, and migration specification is `docs/ui-product-experience.md`.

## Core user flow

1. **Choose a model type**
   - Browse supported model types and their capabilities.
   - Start with `humanoid/chibi-v1` for the initial product.

2. **Upload references**
   - Require one image for the minimum viable flow.
   - Allow optional front, side, back, and detail images for improved fidelity.
   - Normalize orientation, scale, crop, and image metadata.

3. **Analyze the references**
   - Detect or collect landmarks, silhouette, proportions, major colors, and style characteristics.
   - Produce a versioned, editable intermediate representation called StyleDNA.

4. **Generate the model**
   - Select a model-type template and procedural generator.
   - Create low-poly topology and materials from the reference analysis.

5. **Rig and skin**
   - Apply the model type's standard skeleton.
   - Generate or transfer skin weights.
   - Validate joints, hierarchy, transforms, and deformations.

6. **Add basic animations**
   - Include a neutral setup pose and a small model-type-specific animation pack.
   - The humanoid MVP targets an A-pose, idle, walk, and wave.

7. **Preview and refine**
   - Preview the model and animation clips in the browser.
   - Expose corrections that change the intermediate representation rather than requiring direct mesh editing.

8. **Export**
   - Validate the glTF asset.
   - Download one `.glb` containing the mesh, materials, rig, and selected animation clips.

## MVP definition

The first complete vertical slice is:

- Model type: `humanoid/chibi-v1`
- Input: one front reference image, with optional side and back references
- Output: one low-poly humanoid `.glb`
- Geometry: recognizable proportions and major color regions
- Rig: standard humanoid skeleton with usable skin weights
- Animations: A-pose, idle, walk, and wave
- Experience: understand the product, continue as guest, follow the guided workflow, preview, and download
- Reproducibility: the build records model type, pipeline version, StyleDNA, and generation settings

## Product principles

- **Useful from one image:** A single image must produce a coherent result, while the UI clearly communicates where additional views improve accuracy.
- **Stylized rather than photoreal:** The product optimizes for clean low-poly interpretation, not exact human reconstruction.
- **Deterministic and editable:** The same versioned inputs and settings should reproduce the same asset.
- **Model-type extensibility:** Shared pipeline stages operate through model type contracts and capability declarations.
- **Portable output:** Exported GLBs should work in common engines and viewers without repository-specific runtime code.
- **Transparent limitations:** The application should expose confidence, assumptions, unsupported features, and validation failures.
- **Guided rather than tool-first:** A first-time user should always understand the current step and next action without learning pipeline terminology.
- **Visual work surface first:** References and generated characters receive the largest usable region, and every required image or model region remains reachable.

## Initial non-goals

- Photorealistic reconstruction
- Film-quality facial rigs
- Cloth, hair, or fluid simulation
- Arbitrary production-ready topology from every possible image
- Automatic support for every body plan before the model type contract is stable
- Cloud-scale rendering or paid production infrastructure before the local pipeline works end to end
- Account storage, billing, and team workspaces before the guest product flow is coherent

## Success criteria

The MVP is successful when a first-time user can understand the product from the landing experience, continue as a guest, upload a character image, complete the guided workflow without using Blender directly, and download a recognizable low-poly humanoid GLB that loads successfully, contains a skeleton, and plays the included animation clips.