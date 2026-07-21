import path from 'node:path'
import type { BuildJobManifest } from './build-jobs.js'
import { BuildJobStore } from './build-jobs.js'
import { runCommand, type CommandRunner } from './model-runner.js'

function requireModelArtifacts(job: BuildJobManifest) {
  if (job.stages.model.status !== 'completed') {
    throw new Error('Model stage must be completed before the rig stage can run')
  }
  const artifacts = new Set(job.stages.model.artifacts)
  for (const required of ['artifacts/model/style-dna.json', 'artifacts/model/humanoid.blend']) {
    if (!artifacts.has(required)) {
      throw new Error(`Model stage is missing required rig input ${required}`)
    }
  }
}

export async function runHumanoidRigStage(options: {
  jobId: string
  jobs: BuildJobStore
  buildWorkspace: string
  projectRoot: string
  commandRunner?: CommandRunner
}) {
  const job = await options.jobs.get(options.jobId)
  if (!job) throw new Error(`Build job not found: ${options.jobId}`)
  if (job.modelTypeId !== 'humanoid/chibi-v1') {
    throw new Error(`Rig runner does not support ${job.modelTypeId}`)
  }
  requireModelArtifacts(job)

  const jobDir = path.join(options.buildWorkspace, job.id)
  const modelDir = path.join(jobDir, 'artifacts', 'model')
  const rigDir = path.join(jobDir, 'artifacts', 'rig')

  await options.jobs.startStage(job.id, 'rig')
  try {
    const runner = options.commandRunner ?? runCommand
    await runner(
      process.env.BLENDER_COMMAND ?? 'blender',
      [
        '-b',
        '--python',
        path.join(options.projectRoot, 'packages/asset-compiler/blender/scripts/build_humanoid_rig_job.py'),
        '--',
        '--input-blend',
        path.join(modelDir, 'humanoid.blend'),
        '--style-dna',
        path.join(modelDir, 'style-dna.json'),
        '--output-dir',
        rigDir,
        '--job-id',
        job.id
      ],
      options.projectRoot
    )

    return options.jobs.completeStage(job.id, 'rig', {
      artifacts: [
        'artifacts/rig/humanoid-rigged.blend',
        'artifacts/rig/humanoid-rigged.glb',
        'artifacts/rig/rig-metadata.json'
      ]
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await options.jobs.failStage(job.id, 'rig', {
      message,
      code: 'HUMANOID_RIG_FAILED',
      details: 'Inspect the model-stage artifacts and Blender rig output.'
    })
    throw error
  }
}
