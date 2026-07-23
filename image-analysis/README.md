# Local image-analysis workspace

This directory contains instructions for generating review images from local Blender artifacts. Generated PNGs, metadata copies, build intermediates, and ZIP archives are written under `image-analysis/output/`, which is ignored by Git.

Generated review assets must not be committed to this public repository. They may contain local build output or user-derived character assets. Upload the resulting ZIP directly to the review conversation instead.

## Pinned Blender toolchain

The repository pins Blender in `.blender-version`. On Linux x86_64, install the verified official portable build with:

```bash
pnpm blender:setup
```

The installer downloads Blender from `download.blender.org`, verifies the pinned SHA-256 and Blender build hash, and writes it under the ignored `.tools/blender/` directory. `pnpm rig-review` automatically prefers `.tools/blender/current/blender` when `BLENDER_COMMAND` is not set.

On another platform, install the same Blender version separately and set `BLENDER_COMMAND` to its executable path.

## PR #21 rig review

Update the branch and run:

```bash
git pull --ff-only
pnpm blender:setup
pnpm rig-review
```

With no arguments, the command always builds fresh compact and tall fixtures from the current checkout, rigs them, renders them, and packages the result. This prevents an older completed job from being mistaken for the current implementation.

To render two already-completed build jobs instead:

```bash
pnpm rig-review COMPACT_JOB_ID TALL_JOB_ID
```

To override the repository-managed executable:

```bash
BLENDER_COMMAND=/path/to/blender pnpm rig-review
```

Every Blender Python invocation uses factory startup and a nonzero Python exit code, so a script traceback immediately fails the stage.

A successful review package is written to:

```text
image-analysis/output/pr-21-rig-review.zip
```

When Blender, modeling, rigging, validation, or rendering fails, the command preserves the logs and partial outputs in:

```text
image-analysis/output/pr-21-rig-review-failed.zip
```

Upload the failed ZIP for diagnosis rather than manually collecting individual log files. Its `failure-summary.txt` and package manifest identify the failed step, exit code, command, and exact Git commit.

GitHub Actions runs this same compact/tall workflow with the pinned Blender build under a virtual X display. The generated success or failure ZIP is retained as a workflow artifact for seven days.

For each successful fixture, the package contains:

- five consistent neutral turnaround views
- a neutral front wireframe view
- combined posed front, three-quarter, and side views
- isolated shoulder, elbow, wrist, hip, knee, ankle, and neck deformation views
- rig metadata and Blender model, rig, and render logs
- a package manifest containing the exact Git commit and artifact source mode
