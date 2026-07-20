# Low Poly Character Studio

Low Poly Character Studio is an image-to-asset compiler for creating stylized, rigged, low-poly 3D models.

The intended user flow is:

1. Choose a supported model type.
2. Upload one or more reference images.
3. Review or adjust inferred StyleDNA.
4. Run modeling, rigging, animation, validation, and export stages.
5. Preview the result and download a `.glb`.

The first end-to-end target is `humanoid/chibi-v1`: a recognizable low-poly humanoid generated from a front image, optionally improved with side and back references, rigged to a standard skeleton, and exported with A-pose, idle, walk, and wave animations.

## Project direction

- [Product vision](docs/product-vision.md)
- [Architecture direction](docs/architecture.md)
- [Task management](docs/task-management.md)
- [Agent steering](AGENTS.md)

GitHub Issues are the canonical backlog. Scheduled developer runs reconstruct task state from issue titles, issue comments, pull requests, and repository documentation.

## Current implementation

The repository currently contains:

- a React, Vite, and Three.js Style Studio
- a landmark-based StyleDNA editor
- an Express API that invokes local Blender builds
- procedural Blender scripts for low-poly human parts and a base human
- GLB preview support in the Studio

The current Style Studio flow still uses bundled reference images and local Blender execution. Image upload, a model type registry, full rigging, animation, job persistence, and validated downloadable export are planned work.

## Local development

Install dependencies and start the API and Studio together:

```bash
pnpm install
./scripts/build.sh -dev
```

Open:

```text
http://localhost:5173/
```

Run only the Style Studio:

```bash
./scripts/build.sh -studio
```

Build the Style Studio:

```bash
pnpm studio:build
```

Run a Blender target:

```bash
./scripts/build.sh -human
./scripts/build.sh -head
./scripts/build.sh -torso
./scripts/build.sh -arms
./scripts/build.sh -legs
```

## CI and delivery

Pull requests and pushes to `main` build the Studio and validate shell and Python source syntax through GitHub Actions. Tags beginning with `v` build and attach a versioned Studio artifact to a GitHub release.
