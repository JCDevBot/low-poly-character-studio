# Local image-analysis workspace

This directory contains instructions for generating review images from local Blender artifacts. Generated PNGs, metadata copies, build intermediates, and ZIP archives are written under `image-analysis/output/`, which is ignored by Git.

Generated review assets must not be committed to this public repository. They may contain local build output or user-derived character assets. Upload the resulting ZIP directly to the review conversation instead.

## PR #21 rig review

Update the branch and run:

```bash
git pull --ff-only
pnpm rig-review
```

With no arguments, the command always builds fresh compact and tall fixtures from the current checkout, rigs them, renders them, and packages the result. This prevents an older completed job from being mistaken for the current implementation.

To render two already-completed build jobs instead:

```bash
pnpm rig-review COMPACT_JOB_ID TALL_JOB_ID
```

The command uses `blender` by default. To use another executable:

```bash
BLENDER_COMMAND=/path/to/blender pnpm rig-review
```

The review package is written to:

```text
image-analysis/output/pr-21-rig-review.zip
```

For each fixture, the package contains:

- five consistent neutral turnaround views
- a neutral front wireframe view
- combined posed front, three-quarter, and side views
- isolated shoulder, elbow, wrist, hip, knee, ankle, and neck deformation views
- rig metadata and Blender model, rig, and render logs
- a package manifest containing the exact Git commit and artifact source mode
