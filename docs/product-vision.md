# Product Vision

## Purpose

Low Poly Character Studio is an image-to-asset compiler for producing usable, stylized 3D assets.

A user supplies one or more reference images, chooses a supported model type, reviews or adjusts the inferred shape and style, runs an automated modeling and rigging pipeline, previews the result, and downloads a validated `.glb` containing the model, materials, skeleton, and basic animations.

The first supported model type is a stylized humanoid. The system must be designed so additional model types, such as animals, vehicles, props, buildings, or foliage, can be added without rewriting the shared application.

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
- Experience: upload, process, preview, download
- Reproducibility: the build records model type, pipeline version, StyleDNA, and generation settings

## Product principles

- **Useful from one image:** A single image must produce a coherent result, while the UI clearly communicates where additional views improve accuracy.
- **Stylized rather than photoreal:** The product optimizes for clean low-poly interpretation, not exact human reconstruction.
- **Deterministic and editable:** The same versioned inputs and settings should reproduce the same asset.
- **Model-type extensibility:** Shared pipeline stages operate through model type contracts and capability declarations.
- **Portable output:** Exported GLBs should work in common engines and viewers without repository-specific runtime code.
- **Transparent limitations:** The application should expose confidence, assumptions, unsupported features, and validation failures.

## Initial non-goals

- Photorealistic reconstruction
- Film-quality facial rigs
- Cloth, hair, or fluid simulation
- Arbitrary production-ready topology from every possible image
- Automatic support for every body plan before the model type contract is stable
- Cloud-scale rendering or paid production infrastructure before the local pipeline works end to end

## Success criteria

The MVP is successful when a first-time user can upload a character image and, without using Blender directly, download a recognizable low-poly humanoid GLB that loads successfully, contains a skeleton, and plays the included animation clips.
