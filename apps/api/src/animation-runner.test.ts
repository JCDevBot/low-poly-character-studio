import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BuildJobStore } from './build-jobs.js'
import { readAnimationMetadata, runHumanoidAnimationStage } from './animation-runner.js'

const workspace = await mkdtemp(path.join(os.tmpdir(), 'low-poly-animation-runner-'))

async function completeRig(jobs: BuildJobStore, jobId: string) {
  await jobs.startStage(jobId, 'rig')
  await jobs.completeStage(jobId, 'rig', {
    artifacts: [
      'artifacts/rig/humanoid-rigged.blend',
      'artifacts/rig/humanoid-rigged.glb',
      'artifacts/rig/rig-metadata.json'
    ]
  })
}

try {
  const jobs = new BuildJobStore(workspace)
  const job = await jobs.create({ modelTypeId: 'humanoid/chibi-v1' })
  await completeRig(jobs, job.id)

  let invocation: { command: string; args: string[]; cwd: string } | undefined
  const completed = await runHumanoidAnimationStage({
    jobId: job.id,
    jobs,
    buildWorkspace: workspace,
    projectRoot: '/project',
    commandRunner: async (command, args, cwd) => { invocation = { command, args, cwd } }
  })

  assert.equal(completed.stages.animate.status, 'completed')
  assert.ok(completed.stages.animate.artifacts.includes('artifacts/animate/humanoid-animated.glb'))
  assert.ok(completed.stages.animate.artifacts.includes('artifacts/animate/animation-metadata.json'))
  assert.equal(invocation?.command, 'blender')
  assert.equal(invocation?.cwd, '/project')
  assert.ok(invocation?.args.some(argument => argument.endsWith('/build_humanoid_animation_job.py')))
  assert.ok(invocation?.args.includes('--input-blend'))

  const metadataDir = path.join(workspace, job.id, 'artifacts', 'animate')
  await mkdir(metadataDir, { recursive: true })
  await writeFile(path.join(metadataDir, 'animation-metadata.json'), JSON.stringify({
    schema: 'humanoid-animation-pack/v1',
    packId: 'humanoid-basic-v1/default-v1',
    rigId: 'humanoid-basic-v1',
    fps: 24,
    jobId: job.id,
    modelTypeId: 'humanoid/chibi-v1',
    clips: [
      { name: 'a-pose', startFrame: 1, endFrame: 1, durationSeconds: 0, loop: false, rootMotion: false, targetJoints: ['upper_arm.L'] },
      { name: 'idle', startFrame: 1, endFrame: 49, durationSeconds: 2, loop: true, rootMotion: false, targetJoints: ['hips'] },
      { name: 'walk', startFrame: 1, endFrame: 25, durationSeconds: 1, loop: true, rootMotion: false, targetJoints: ['thigh.L'] },
      { name: 'wave', startFrame: 1, endFrame: 49, durationSeconds: 2, loop: false, rootMotion: false, targetJoints: ['hand.R'] }
    ]
  }))
  const metadata = await readAnimationMetadata({ jobId: job.id, jobs, buildWorkspace: workspace })
  assert.deepEqual(metadata.clips.map(clip => clip.name), ['a-pose', 'idle', 'walk', 'wave'])

  const unrigged = await jobs.create({ modelTypeId: 'humanoid/chibi-v1' })
  await assert.rejects(
    () => runHumanoidAnimationStage({
      jobId: unrigged.id,
      jobs,
      buildWorkspace: workspace,
      projectRoot: '/project',
      commandRunner: async () => undefined
    }),
    /Rig stage must be completed/
  )
  assert.equal((await jobs.get(unrigged.id))?.stages.animate.status, 'pending')

  const failedJob = await jobs.create({ modelTypeId: 'humanoid/chibi-v1' })
  await completeRig(jobs, failedJob.id)
  await assert.rejects(
    () => runHumanoidAnimationStage({
      jobId: failedJob.id,
      jobs,
      buildWorkspace: workspace,
      projectRoot: '/project',
      commandRunner: async () => { throw new Error('Blender animation failed') }
    }),
    /Blender animation failed/
  )
  const failed = await jobs.get(failedJob.id)
  assert.equal(failed?.stages.animate.status, 'failed')
  assert.equal(failed?.stages.animate.error?.code, 'HUMANOID_ANIMATION_FAILED')

  console.log('humanoid animation runner contract tests passed')
} finally {
  await rm(workspace, { recursive: true, force: true })
}
