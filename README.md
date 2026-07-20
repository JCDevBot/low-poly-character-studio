# Low Poly Character Studio

Low Poly Character Studio is an image-to-asset pipeline for generating stylized, rigged, low-poly 3D models that can be previewed and downloaded as `.glb` files.

## Product goal

A user should be able to:

1. choose a supported model type
2. upload a front reference image, with optional side and back references
3. review or refine inferred style and proportion data
4. run modeling, rigging, animation, validation, and export stages
5. preview the generated asset and its animation clips
6. download one self-contained `.glb`

The first supported model type is `humanoid/chibi-v1`. Its canonical visual target is defined in [`docs/gold-standard-humanoid-chibi.md`](docs/gold-standard-humanoid-chibi.md).

The first animation set targets:

- A-pose
- idle
- walk
- wave

See:

- [`docs/product-vision.md`](docs/product-vision.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/gold-standard-humanoid-chibi.md`](docs/gold-standard-humanoid-chibi.md)
- [`docs/task-management.md`](docs/task-management.md)
- [`AGENTS.md`](AGENTS.md)

## Current implementation

The repository currently contains:

- a React, Vite, and Three.js Style Studio
- landmark editing and StyleDNA generation
- Blender scripts for procedural humanoid parts and a base human
- a local Express API that launches selected Blender builds
- GLB preview support

The current implementation is an early foundation. It does not yet provide the complete upload-to-rigged-model workflow.

## Local development

Requirements:

- Node.js 22
- pnpm 9
- Blender available as `blender` for generation

Install dependencies and start the API and Studio:

```bash
pnpm install
./scripts/build.sh -dev
```

Open:

```text
http://localhost:5173/
```

To run only the Studio:

```bash
./scripts/build.sh -studio
```

To run a current Blender build target:

```bash
./scripts/build.sh -human
./scripts/build.sh -head
```

## Delivery

Pull requests and pushes to `main` run continuous integration. Version tags matching `v*` package the built Style Studio as a GitHub Release artifact.

Blender-capable end-to-end CI and production hosting are separate roadmap items.
