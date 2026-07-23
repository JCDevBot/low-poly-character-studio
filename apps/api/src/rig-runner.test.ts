import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BuildJobStore } from './build-jobs.js'
import { runHumanoidRigStage } from './rig-runner.js'

const styleDna = {
  schema: 'humanoid-style-dna/v1',
  modelTypeId: 'humanoid/chibi-v1',
  blenderHints: {
    totalHeight: 1.35,
    headWidth: 0.44,
    headDepth: 0.38,
    headHeight: 0.43,
    eyeSpacing: 0.17,
    eyeZ: 1.06,
    torsoWidth: 0.28,
    waistWidth: 0.23,
    legLength: 0.28
  }
}

const workspace = await mkdtemp(path.join(os.tmpdir(), 'low-poly-rig-runner-'))

try {
  const jobs = new BuildJobStore(workspace)
  const job = await jobs.create({ modelTypeId: 'humanoid/chibi-v1', input: { styleDna } })
  await jobs.startStage(job.id, 'model')
  await jobs.completeStage(job.id, 'model', {
    artifacts: [
      'artifacts/model/style-dna.json',
      'artifacts/model/humanoid.blend',
      'artifacts/model/humanoid.glb',
      'artifacts/model/generation-metadata.json'
    ]
  })

  let invocation: { command: string; args: string[]; cwd: string } | undefined
  const completed = await runHumanoidRigStage({
    jobId: job.id,
    jobs,
    buildWorkspace: workspace,
    projectRoot: '/project',
    commandRunner: async (command, args, cwd) => {
      invocation = { command, args, cwd }
    }
  })

  assert.equal(completed.stages.rig.status, 'completed')
  assert.ok(completed.stages.rig.artifacts.includes('artifacts/rig/humanoid-rigged.glb'))
  assert.equal(invocation?.command, 'blender')
  assert.equal(invocation?.cwd, '/project')
  assert.deepEqual(invocation?.args.slice(0, 4), [
    '--background',
    '--factory-startup',
    '--python-exit-code',
    '1'
  ])
  assert.ok(invocation?.args.includes('--input-blend'))
  assert.ok(invocation?.args.includes('--style-dna'))

  const unmodeled = await jobs.create({ modelTypeId: 'humanoid/chibi-v1', input: { styleDna } })
  await assert.rejects(
    () => runHumanoidRigStage({
      jobId: unmodeled.id,
      jobs,
      buildWorkspace: workspace,
      projectRoot: '/project',
      commandRunner: async () => undefined
    }),
    /Model stage must be completed/
  )
  assert.equal((await jobs.get(unmodeled.id))?.stages.rig.status, 'pending')

  const failedJob = await jobs.create({ modelTypeId: 'humanoid/chibi-v1', input: { styleDna } })
  await jobs.startStage(failedJob.id, 'model')
  await jobs.completeStage(failedJob.id, 'model', {
    artifacts: ['artifacts/model/style-dna.json', 'artifacts/model/humanoid.blend']
  })
  await assert.rejects(
    () => runHumanoidRigStage({
      jobId: failedJob.id,
      jobs,
      buildWorkspace: workspace,
      projectRoot: '/project',
      commandRunner: async () => { throw new Error('Blender rig failed') }
    }),
    /Blender rig failed/
  )
  const failed = await jobs.get(failedJob.id)
  assert.equal(failed?.stages.rig.status, 'failed')
  assert.equal(failed?.stages.rig.error?.code, 'HUMANOID_RIG_FAILED')

  console.log('humanoid rig runner contract tests passed')
} finally {
  await rm(workspace, { recursive: true, force: true })
}
