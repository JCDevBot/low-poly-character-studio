import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { BuildJobManifest } from './build-jobs.js'
import { BuildJobStore } from './build-jobs.js'

export type CommandRunner = (command: string, args: string[], cwd: string) => Promise<void>

export const runCommand: CommandRunner = (command, args, cwd) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })

const requiredHints = [
  'totalHeight',
  'headWidth',
  'headDepth',
  'headHeight',
  'eyeSpacing',
  'eyeZ',
  'torsoWidth',
  'waistWidth',
  'legLength'
] as const

function requireStyleDna(job: BuildJobManifest): Record<string, unknown> {
  const input = job.input
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Job input must contain styleDna before the model stage can run')
  }
  const styleDna = (input as Record<string, unknown>).styleDna
  if (!styleDna || typeof styleDna !== 'object' || Array.isArray(styleDna)) {
    throw new Error('Job input.styleDna is required before the model stage can run')
  }
  const document = styleDna as Record<string, unknown>
  if (document.schema !== 'humanoid-style-dna/v1') {
    throw new Error('Job input.styleDna.schema must be humanoid-style-dna/v1')
  }
  if (document.modelTypeId !== job.modelTypeId) {
    throw new Error(`StyleDNA modelTypeId must match job model type ${job.modelTypeId}`)
  }
  const hints = document.blenderHints
  if (!hints || typeof hints !== 'object' || Array.isArray(hints)) {
    throw new Error('Job input.styleDna.blenderHints must be an object')
  }
  for (const name of requiredHints) {
    const value = (hints as Record<string, unknown>)[name]
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`Job input.styleDna.blenderHints.${name} must be a positive number`)
    }
  }
  return document
}

export async function runHumanoidModelStage(options: {
  jobId: string
  jobs: BuildJobStore
  buildWorkspace: string
  projectRoot: string
  commandRunner?: CommandRunner
}) {
  const job = await options.jobs.get(options.jobId)
  if (!job) throw new Error(`Build job not found: ${options.jobId}`)
  if (job.modelTypeId !== 'humanoid/chibi-v1') {
    throw new Error(`Model runner does not support ${job.modelTypeId}`)
  }

  const styleDna = requireStyleDna(job)
  const artifactDir = path.join(options.buildWorkspace, job.id, 'artifacts', 'model')
  const styleDnaPath = path.join(artifactDir, 'style-dna.json')
  await mkdir(artifactDir, { recursive: true })
  await writeFile(styleDnaPath, `${JSON.stringify(styleDna, null, 2)}\n`, 'utf8')

  await options.jobs.startStage(job.id, 'model')
  try {
    const runner = options.commandRunner ?? runCommand
    await runner(
      process.env.BLENDER_COMMAND ?? 'blender',
      [
        '-b',
        '--python',
        path.join(options.projectRoot, 'packages/asset-compiler/blender/scripts/build_humanoid_job.py'),
        '--',
        '--style-dna',
        styleDnaPath,
        '--output-dir',
        artifactDir,
        '--job-id',
        job.id
      ],
      options.projectRoot
    )

    return options.jobs.completeStage(job.id, 'model', {
      artifacts: [
        'artifacts/model/style-dna.json',
        'artifacts/model/humanoid.blend',
        'artifacts/model/humanoid.glb',
        'artifacts/model/generation-metadata.json'
      ]
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await options.jobs.failStage(job.id, 'model', {
      message,
      code: 'HUMANOID_MODEL_FAILED',
      details: 'Inspect Blender output and the persisted StyleDNA artifact.'
    })
    throw error
  }
}
