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
- `POST /jobs/:id/stages/:stage/start` marks one stage running.
- `POST /jobs/:id/stages/:stage/complete` marks it complete and accepts an `artifacts` array.
- `POST /jobs/:id/stages/:stage/fail` records `message`, optional `code`, and optional `details`.

The stage endpoints are orchestration boundaries rather than a hosted queue. Blender remains a local serial process. A runner starts a stage, invokes Blender or another local tool, then records completion or failure. Atomic manifest replacement prevents a partial JSON write from replacing the last valid state.

## Example

```bash
curl -X POST http://localhost:3001/jobs \
  -H 'content-type: application/json' \
  -d '{"modelTypeId":"humanoid/chibi-v1","input":{"schema":"reference-set/v1"}}'
```

Use the returned job ID to advance a stage:

```bash
curl -X POST http://localhost:3001/jobs/JOB_ID/stages/ingest/start
curl -X POST http://localhost:3001/jobs/JOB_ID/stages/ingest/complete \
  -H 'content-type: application/json' \
  -d '{"artifacts":["artifacts/normalized-front.png"]}'
```
