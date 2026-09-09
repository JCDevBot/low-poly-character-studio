# Chibi Style Kit

## Intent

`humanoid/chibi-v1` is a designed character system, not a request to create arbitrary new topology for every reference image.

The style kit combines a canonical humanoid rig, reusable low-poly parts, named presets, and a curated set of bounded proportion controls. Reference-image analysis proposes a configuration inside this system; the same configuration can be edited manually in the Studio and reproduced without the original images.

## Character-creator model

The primary editing experience should resemble a focused game character creator:

- choose a preset as a starting point;
- swap intentional feature variants from visual selectors;
- adjust a limited set of meaningful proportion controls;
- preview the result on the canonical rig;
- preserve the exact configuration for regeneration, saving, packaging, and export.

The Studio should not expose raw Blender object names, bones, vertex groups, or arbitrary vertex-level editing as normal appearance controls.

## Discrete variants vs. continuous controls

Use **discrete variants** when the feature is primarily an art-direction choice. Initial semantic slots are:

- body shape
- head shape
- eyes
- nose
- mouth
- ears
- hair
- torso/clothing presentation
- hands
- feet

Use **bounded continuous controls** when interpolation is useful and can remain rig-safe. The initial contract includes:

- Chibi head/body proportion (`heads-tall`)
- head width
- head depth
- eye spacing
- eye vertical placement
- shoulder width
- waist width
- arm length
- leg width
- foot length
- cheek fullness
- cranium roundness

The internal implementation may use StyleDNA, `LittleGuyDNA`, procedural geometry parameters, shape keys, transforms, or another deterministic mechanism. Those implementation details should remain behind semantic control IDs.

## Compatibility requirements

Every reusable variant declares enough metadata to prove that it belongs in the selected style family:

- exact style-kit version
- compatible rig ID
- semantic slot
- source-part ID
- material slots
- parent/attachment relationship
- rig or semantic anchor
- deformation role

Structural variants must preserve the joint and deformation assumptions required by the canonical rig. Presentation variants may be simpler, but they still must attach predictably and export cleanly.

The assembler must reject incompatible combinations before final export rather than attempting to repair them silently in Blender.

## Configuration contract

A complete character style configuration records:

- configuration schema version
- exact style-kit ID and version
- model-type ID
- source (`preset`, `reference-analysis`, or `user`)
- exact variant selection for every required slot
- a concrete value for every declared bounded control

This is the authoritative appearance input to deterministic assembly. The original reference images are evidence used to propose a configuration, not a hidden dependency required to reproduce the accepted character.

## Presets

The current approved character becomes the first named preset: **Gold Standard Chibi**.

A preset is not a separate mesh. It is a complete style configuration containing exact variant selections and control values. Future presets should be composed from the same part/control vocabulary so users can start from a coherent look and continue editing without crossing into a parallel generation path.

## Reference-image mapping

Reference analysis should answer questions such as:

- Which approved head shape is closest?
- Which eye, mouth, hair, and clothing variants best fit the evidence?
- What bounded head/torso/limb proportions best match the silhouette?
- Which selections are ambiguous enough to surface alternatives?
- Which measurements fall outside the Chibi envelope and therefore need clamping or a user-visible assumption?

The result is a confidence-bearing style configuration proposal. User overrides remain explicit and must not be silently replaced by later analysis.

## Relationship to capability authoring

Appearance and capability are separate but connected contracts.

The style kit determines what character is assembled and how it remains rig-compatible. The capability layer then inspects the resulting semantic parts/rig and determines what functional roles and semantic actions are supported.

Cosmetic changes such as eye or hair variants should not normally invalidate capability inference. Structural changes that alter rig-relevant anatomy or contacts may invalidate downstream capability, animation, demo, validation, and export artifacts.

## Implementation sequence

1. Define and validate the style-kit/configuration contracts (#80).
2. Build reusable Chibi source variants and deterministic assembly (#81).
3. Add visual preset selectors and bounded controls to the Studio (#82).
4. Map reference analysis to the same editable style configuration (#83).
5. Continue capability inference and behavior authoring downstream of the accepted assembled/rigged character (#72 and related capability issues).
