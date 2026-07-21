# Persistent Build Jobs

The local API stores versioned build manifests under `.workspace/build-jobs/`. The workspace is intentionally ignored by Git and can be relocated with the `BUILD_WORKSPACE` environment variable.

Each `build-job/v1` manifest records the model type, immutable creation time, updated time, original input, and state for these ordered stages:

```text
ingest -> analyze -> model -> rig -> animate -> validate -> export
```

A stage is `pending`, `running`, `completed`, or `failed`. Completed stages retain their artifact paths. Failed stages retain an actionable message plus optional code and details, so earlier completed outputs remain available for inspection or retry.

## Local API

- `POST /jobs` creates a job. The request body contains `modelTypeId` and optional `input`.
- `GET /jobs` lists jobs from disk.
- `GET /jobs/:id` retrieves a persisted manifest.
- `GET /jobs/:id/artifacts` lists artifact paths recorded by completed stages.
- `POST /jobs/:id/stages/model/run` validates the job StyleDNA, invokes the humanoid Blender model runner, and records its artifacts.
- `POST /jobs/:id/stages/:stage/start` marks one stage running.
- `POST /jobs/:id/stages/:stage/complete` marks it complete and accepts an `artifacts` array.
- `POST /jobs/:id/stages/:stage/fail` records `message`, optional `code`, and optional `details`.

The generic stage endpoints are orchestration boundaries rather than a hosted queue. Blender remains a local serial process. Atomic manifest replacement prevents a partial JSON write from replacing the last valid state.

## Humanoid model input

Normal `humanoid/chibi-v1` model jobs require a validated `humanoid-style-dna/v1` document at `input.styleDna`. The model runner persists that exact input as `artifacts/model/style-dna.json`, passes it to Blender, and records:

```text
artifacts/model/style-dna.json
artifacts/model/humanoid.blend
artifacts/model/humanoid.glb
artifacts/model/generation-metadata.json
```

The GLB root and Blender scene metadata identify the model type, StyleDNA schema, and job ID. The separate `--preset little-guy` Blender path remains available for the bundled example; normal jobs do not silently fall back to it.

## Example

```bash
curl -X POST http://localhost:3001/jobs \
  -H 'content-type: application/json' \
  -d '{
    "modelTypeId":"humanoid/chibi-v1",
    "input":{
      "styleDna":{
        "schema":"humanoid-style-dna/v1",
        "modelTypeId":"humanoid/chibi-v1",
        "source":"manual fixture",
        "blenderHints":{
          "totalHeight":1.35,
          "headWidth":0.44,
          "headDepth":0.38,
          "headHeight":0.43,
          "eyeSpacing":0.17,
          "eyeZ":1.06,
          "torsoWidth":0.28,
          "waistWidth":0.23,
          "legLength":0.28
        }
      }
    }
  }'
```

Use the returned job ID to run the modeling stage:

```bash
curl -X POST http://localhost:3001/jobs/JOB_ID/stages/model/run
```

Blender must be available as `blender`, or `BLENDER_COMMAND` must point to the executable.
