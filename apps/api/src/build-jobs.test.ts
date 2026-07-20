import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BuildJobStore, PIPELINE_STAGES } from './build-jobs.js'

const workspace = await mkdtemp(path.join(os.tmpdir(), 'low-poly-build-jobs-'))

try {
  const firstStore = new BuildJobStore(workspace)
  const created = await firstStore.create({
    modelTypeId: 'humanoid/chibi-v1',
    input: { schema: 'reference-set/v1', references: { front: { name: 'front.png' } } }
  })

  assert.equal(created.schema, 'build-job/v1')
  assert.deepEqual(Object.keys(created.stages), [...PIPELINE_STAGES])
  assert.ok(PIPELINE_STAGES.every(stage => created.stages[stage].status === 'pending'))

  await firstStore.startStage(created.id, 'ingest')
  await firstStore.completeStage(created.id, 'ingest', { artifacts: ['artifacts/normalized-front.png'] })
  await firstStore.startStage(created.id, 'analyze')
  const failed = await firstStore.failStage(created.id, 'analyze', {
    message: 'No face landmarks detected',
    code: 'LANDMARKS_NOT_FOUND',
    details: 'Provide a clearer front reference.'
  })

  assert.equal(failed.stages.ingest.status, 'completed')
  assert.equal(failed.stages.analyze.status, 'failed')
  assert.equal(failed.stages.analyze.error?.code, 'LANDMARKS_NOT_FOUND')

  const restartedStore = new BuildJobStore(workspace)
  const restored = await restartedStore.get(created.id)
  assert.ok(restored)
  assert.equal(restored.stages.ingest.status, 'completed')
  assert.equal(restored.stages.analyze.status, 'failed')
  assert.deepEqual(await restartedStore.listArtifacts(created.id), ['artifacts/normalized-front.png'])
  assert.equal((await restartedStore.list()).length, 1)

  await assert.rejects(
    () => restartedStore.create({ modelTypeId: 'unsupported/v1' }),
    /Unsupported model type/
  )
  await assert.rejects(() => restartedStore.startStage(created.id, 'unknown'), /Unknown pipeline stage/)

  console.log('build job store contract tests passed')
} finally {
  await rm(workspace, { recursive: true, force: true })
}
