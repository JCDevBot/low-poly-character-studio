import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BuildJobStore } from './build-jobs.js'
import { runHumanoidModelStage } from './model-runner.js'

const styleDna = {
  schema: 'humanoid-style-dna/v1',
  modelTypeId: 'humanoid/chibi-v1',
  source: 'model runner fixture',
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

const workspace = await mkdtemp(path.join(os.tmpdir(), 'low-poly-model-runner-'))

try {
  const jobs = new BuildJobStore(workspace)
  const job = await jobs.create({
    modelTypeId: 'humanoid/chibi-v1',
    input: { styleDna }
  })

  let invocation: { command: string; args: string[]; cwd: string } | undefined
  const completed = await runHumanoidModelStage({
    jobId: job.id,
    jobs,
    buildWorkspace: workspace,
    projectRoot: '/project',
    commandRunner: async (command, args, cwd) => {
      invocation = { command, args, cwd }
    }
  })

  assert.equal(completed.stages.model.status, 'completed')
  assert.ok(completed.stages.model.artifacts.includes('artifacts/model/humanoid.glb'))
  assert.equal(invocation?.command, 'blender')
  assert.equal(invocation?.cwd, '/project')
  assert.ok(invocation?.args.includes('--style-dna'))
  assert.deepEqual(
    JSON.parse(await readFile(path.join(workspace, job.id, 'artifacts/model/style-dna.json'), 'utf8')),
    styleDna
  )

  const failedJob = await jobs.create({
    modelTypeId: 'humanoid/chibi-v1',
    input: { styleDna }
  })
  await assert.rejects(
    () =>
      runHumanoidModelStage({
        jobId: failedJob.id,
        jobs,
        buildWorkspace: workspace,
        projectRoot: '/project',
        commandRunner: async () => {
          throw new Error('Blender unavailable')
        }
      }),
    /Blender unavailable/
  )
  const failed = await jobs.get(failedJob.id)
  assert.equal(failed?.stages.model.status, 'failed')
  assert.equal(failed?.stages.model.error?.code, 'HUMANOID_MODEL_FAILED')

  const missingDna = await jobs.create({ modelTypeId: 'humanoid/chibi-v1', input: {} })
  await assert.rejects(
    () =>
      runHumanoidModelStage({
        jobId: missingDna.id,
        jobs,
        buildWorkspace: workspace,
        projectRoot: '/project',
        commandRunner: async () => undefined
      }),
    /input\.styleDna is required/
  )
  const unchanged = await jobs.get(missingDna.id)
  assert.equal(unchanged?.stages.model.status, 'pending')

  console.log('humanoid model runner contract tests passed')
} finally {
  await rm(workspace, { recursive: true, force: true })
}
