import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BuildJobStore, type PipelineStage } from './build-jobs.js'
import { runCompleteHumanoidPipeline } from './pipeline-runner.js'

async function complete(jobs: BuildJobStore, id: string, stage: PipelineStage, artifact: string) {
  await jobs.startStage(id, stage)
  await jobs.completeStage(id, stage, { artifacts: [artifact] })
}

async function main() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'pipeline-runner-'))
  try {
    const jobs = new BuildJobStore(workspace)
    const input = {
      referenceSet: {
        schemaVersion: 'reference-set/v1',
        references: { front: { name: 'gold-standard-humanoid-chibi.png' } },
        analysis: {
          schemaVersion: 'humanoid-reference-analysis/v1',
          modelTypeId: 'humanoid/chibi-v1'
        },
        modelTypeConfirmation: {
          schemaVersion: 'model-type-confirmation/v1',
          modelTypeId: 'humanoid/chibi-v1',
          confirmedAt: '2026-07-27T00:00:00Z',
          source: 'user'
        }
      }
    }
    const created = await jobs.create({ modelTypeId: 'humanoid/chibi-v1', input })
    const calls: string[] = []

    const run = () => runCompleteHumanoidPipeline({
      jobId: created.id,
      jobs,
      runModel: async id => { calls.push('model'); await complete(jobs, id, 'model', 'artifacts/model/model.json') },
      runRig: async id => { calls.push('rig'); await complete(jobs, id, 'rig', 'artifacts/rig/rig.json') },
      runAnimation: async id => { calls.push('animate'); await complete(jobs, id, 'animate', 'artifacts/animate/humanoid-animated.glb') },
      finalize: async id => {
        calls.push('finalize')
        await complete(jobs, id, 'validate', 'artifacts/validate/final-glb-validation.json')
        await complete(jobs, id, 'export', 'artifacts/export/humanoid-final.glb')
      }
    })

    const completed = await run()
    assert.deepEqual(calls, ['model', 'rig', 'animate', 'finalize'])
    for (const stage of ['ingest', 'analyze', 'model', 'rig', 'animate', 'validate', 'export'] as PipelineStage[]) {
      assert.equal(completed.stages[stage].status, 'completed')
    }

    calls.length = 0
    await run()
    assert.deepEqual(calls, [], 'completed stages must be skipped on resume')

    const invalid = await jobs.create({ modelTypeId: 'humanoid/chibi-v1', input: { referenceSet: { references: {} } } })
    await assert.rejects(
      () => runCompleteHumanoidPipeline({
        jobId: invalid.id,
        jobs,
        runModel: async () => {},
        runRig: async () => {},
        runAnimation: async () => {},
        finalize: async () => {}
      }),
      /front reference is required/
    )

    console.log('complete pipeline runner tests passed')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

await main()
