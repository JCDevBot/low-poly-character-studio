# Local image-analysis workspace

This directory contains instructions for generating review images from local Blender artifacts. Generated PNGs, metadata copies, and ZIP archives are written under `image-analysis/output/`, which is ignored by Git.

Generated review assets must not be committed to this public repository. They may contain local build output or user-derived character assets. Upload the resulting ZIP directly to the review conversation instead.

## PR #21 rig review

After compact and tall jobs have completed both the model and rig stages, run:

```bash
pnpm rig-review COMPACT_JOB_ID TALL_JOB_ID
```

The command uses `blender` by default. To use another executable:

```bash
BLENDER_COMMAND=/path/to/blender pnpm rig-review COMPACT_JOB_ID TALL_JOB_ID
```

The review package is written to:

```text
image-analysis/output/pr-21-rig-review.zip
```

For each fixture, the package contains consistent neutral turnaround views, posed deformation views, a wireframe view when supported by the installed Blender version, the rig metadata, and a render manifest.
