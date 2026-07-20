# Adding a Model Type

Model types are registered through the shared contract in `packages/model-types/src`. The Studio and API both re-export that contract from their own source trees, so model-type discovery and validation must remain independent of UI-specific conditionals.

## Required steps

1. Add a manifest under `packages/model-types/src/manifests/`.
2. Type the object with `satisfies ModelTypeManifest`.
3. Register it in `packages/model-types/src/registry.ts`.
4. Add contract tests for validation, reference slots, capabilities, and registry lookup.
5. Document any model-type-specific analysis, generation, rigging, animation, validation, and export implementation IDs.
6. Declare whether the model type is `available`, `experimental`, or `planned`.

The runtime validator rejects malformed manifests and duplicate IDs with field-level error paths. Keep model type IDs stable and version behavior through the manifest version rather than silently changing an existing contract.

## Visual baselines

A new model type may intentionally use proportions or a style that differs from `humanoid/chibi-v1`, but it must declare those differences in its own manifest and supporting documentation. Do not change the humanoid baseline to accommodate another body plan.

For `humanoid/chibi-v1`, the manifest must continue to link:

- `docs/gold-standard-humanoid-chibi.md`
- `docs/reference/gold-standard-humanoid-chibi.png`

Its declared baseline includes a 2.6-to-2.8-heads-tall proportion range and a target of approximately 2,000 triangles within the initial 1,500-to-3,000 range.

## Shared consumption

API code imports through `apps/api/src/model-types.ts`. Studio code imports through `apps/style-studio/src/model-types.ts`. Both files re-export the same registry implementation, preventing separate model-type definitions from drifting.
