import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BuildJobManifest } from './build-jobs.js'
import { BuildJobStore } from './build-jobs.js'
import { runCommand, type CommandRunner } from './model-runner.js'

export interface AnimationClipMetadata {
  name: string
  startFrame: number
  endFrame: number
  durationSeconds: number
  loop: boolean
  rootMotion: boolean
  targetJoints: string[]
}

export interface AnimationMetadata {
  schema: 'humanoid-animation-pack/v1'
  packId: string
  rigId: 'humanoid-basic-v1'
  fps: number
  clips: AnimationClipMetadata[]
  jobId: string
  modelTypeId: 'humanoid/chibi-v1'
}

function requireRigArtifacts(job: BuildJobManifest) {
  if (job.stages.rig.status !== 'completed') {
    throw new Error('Rig stage must be completed before the animate stage can run')
  }
  const artifacts = new Set(job.stages.rig.artifacts)
  const required = 'artifacts/rig/humanoid-rigged.blend'
  if (!artifacts.has(required)) throw new Error(`Rig stage is missing required animation input ${required}`)
}

export async function readAnimationMetadata(options: {
  jobId: string
  jobs: BuildJobStore
  buildWorkspace: string
}): Promise<AnimationMetadata> {
  const job = await options.jobs.get(options.jobId)
  if (!job) throw new Error(`Build job not found: ${options.jobId}`)
  if (job.stages.animate.status !== 'completed') {
    throw new Error('Animate stage must be completed before animation metadata is available')
  }
  const artifact = 'artifacts/animate/animation-metadata.json'
  if (!job.stages.animate.artifacts.includes(artifact)) {
    throw new Error(`Animate stage is missing required metadata artifact ${artifact}`)
  }
  const metadataPath = path.join(options.buildWorkspace, job.id, artifact)
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as AnimationMetadata
  if (metadata.schema !== 'humanoid-animation-pack/v1' || !Array.isArray(metadata.clips)) {
    throw new Error('Animation metadata does not match humanoid-animation-pack/v1')
  }
  return metadata
}

export async function runHumanoidAnimationStage(options: {
  jobId: string
  jobs: BuildJobStore
  buildWorkspace: string
  projectRoot: string
  commandRunner?: CommandRunner
}) {
  const job = await options.jobs.get(options.jobId)
  if (!job) throw new Error(`Build job not found: ${options.jobId}`)
  if (job.modelTypeId !== 'humanoid/chibi-v1') {
    throw new Error(`Animation runner does not support ${job.modelTypeId}`)
  }
  requireRigArtifacts(job)

  const jobDir = path.join(options.buildWorkspace, job.id)
  const rigDir = path.join(jobDir, 'artifacts', 'rig')
  const animationDir = path.join(jobDir, 'artifacts', 'animate')

  await options.jobs.startStage(job.id, 'animate')
  try {
    const runner = options.commandRunner ?? runCommand
    await runner(
      process.env.BLENDER_COMMAND ?? 'blender',
      [
        '--background',
        '--factory-startup',
        '--python-exit-code',
        '1',
        '--python',
        path.join(options.projectRoot, 'packages/asset-compiler/blender/scripts/build_humanoid_animation_job.py'),
        '--',
        '--input-blend',
        path.join(rigDir, 'humanoid-rigged.blend'),
        '--output-dir',
        animationDir,
        '--job-id',
        job.id
      ],
      options.projectRoot
    )

    return options.jobs.completeStage(job.id, 'animate', {
      artifacts: [
        'artifacts/animate/humanoid-animated.blend',
        'artifacts/animate/humanoid-animated.glb',
        'artifacts/animate/animation-metadata.json'
      ]
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await options.jobs.failStage(job.id, 'animate', {
      message,
      code: 'HUMANOID_ANIMATION_FAILED',
      details: 'Inspect the rig-stage artifact and Blender animation output.'
    })
    throw error
  }
}
