import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BuildJobManifest } from './build-jobs.js'
import { BuildJobStore } from './build-jobs.js'

const GLB_MAGIC = 0x46546c67
const GLB_VERSION = 2
const JSON_CHUNK = 0x4e4f534a

export interface FinalGlbValidation {
  schema: 'final-glb-validation/v1'
  valid: boolean
  sourceArtifact: string
  byteLength: number
  gltfVersion: string | null
  meshCount: number
  materialCount: number
  skinCount: number
  animationClips: string[]
  externalResources: string[]
  errors: string[]
}

export interface FinalArtifactMetadata {
  schema: 'final-artifact/v1'
  jobId: string
  modelTypeId: string
  pipelineSchema: string
  artifact: string
  validationReport: string
  previewUrl: string
  downloadUrl: string
  animationClips: string[]
}

function parseGlbJson(buffer: Buffer): Record<string, unknown> {
  if (buffer.length < 20) throw new Error('GLB is shorter than the required header and JSON chunk')
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('Artifact is not a GLB: invalid magic header')
  if (buffer.readUInt32LE(4) !== GLB_VERSION) throw new Error(`Unsupported GLB version: ${buffer.readUInt32LE(4)}`)
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('GLB declared length does not match file length')
  const jsonLength = buffer.readUInt32LE(12)
  if (buffer.readUInt32LE(16) !== JSON_CHUNK) throw new Error('GLB first chunk is not JSON')
  if (20 + jsonLength > buffer.length) throw new Error('GLB JSON chunk exceeds file length')
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function validateGlbBuffer(buffer: Buffer, sourceArtifact = 'artifact.glb'): FinalGlbValidation {
  const errors: string[] = []
  let document: Record<string, unknown> = {}
  try {
    document = parseGlbJson(buffer)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  const asset = document.asset && typeof document.asset === 'object' ? document.asset as Record<string, unknown> : {}
  const gltfVersion = typeof asset.version === 'string' ? asset.version : null
  if (gltfVersion !== '2.0') errors.push(`Expected glTF asset version 2.0, received ${gltfVersion ?? 'missing'}`)

  const externalResources = [
    ...list(document.buffers),
    ...list(document.images)
  ].flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const uri = (entry as Record<string, unknown>).uri
    return typeof uri === 'string' && !uri.startsWith('data:') ? [uri] : []
  })
  if (externalResources.length) errors.push(`GLB references external resources: ${externalResources.join(', ')}`)

  const meshes = list(document.meshes)
  const materials = list(document.materials)
  const skins = list(document.skins)
  const animations = list(document.animations)
  const animationClips = animations.map((entry, index) => {
    if (!entry || typeof entry !== 'object') return `animation-${index + 1}`
    const name = (entry as Record<string, unknown>).name
    return typeof name === 'string' && name ? name : `animation-${index + 1}`
  })

  if (!meshes.length) errors.push('GLB contains no meshes')
  if (!skins.length) errors.push('GLB contains no skins')
  if (!animations.length) errors.push('GLB contains no animation clips')

  return {
    schema: 'final-glb-validation/v1',
    valid: errors.length === 0,
    sourceArtifact,
    byteLength: buffer.length,
    gltfVersion,
    meshCount: meshes.length,
    materialCount: materials.length,
    skinCount: skins.length,
    animationClips,
    externalResources,
    errors
  }
}

function requireAnimatedGlb(job: BuildJobManifest) {
  if (job.stages.animate.status !== 'completed') throw new Error('Animate stage must be completed before finalization')
  const artifact = 'artifacts/animate/humanoid-animated.glb'
  if (!job.stages.animate.artifacts.includes(artifact)) throw new Error(`Animate stage is missing required finalization input ${artifact}`)
  return artifact
}

export async function finalizeHumanoidGlb(options: {
  jobId: string
  jobs: BuildJobStore
  buildWorkspace: string
}) {
  const job = await options.jobs.get(options.jobId)
  if (!job) throw new Error(`Build job not found: ${options.jobId}`)
  if (job.modelTypeId !== 'humanoid/chibi-v1') throw new Error(`Final artifact runner does not support ${job.modelTypeId}`)

  const sourceArtifact = requireAnimatedGlb(job)
  const jobDir = path.join(options.buildWorkspace, job.id)
  const sourcePath = path.join(jobDir, sourceArtifact)
  const validationArtifact = 'artifacts/validate/final-glb-validation.json'
  const exportArtifact = 'artifacts/export/humanoid-final.glb'
  const metadataArtifact = 'artifacts/export/final-artifact.json'

  await options.jobs.startStage(job.id, 'validate')
  const validation = validateGlbBuffer(await readFile(sourcePath), sourceArtifact)
  await mkdir(path.join(jobDir, 'artifacts', 'validate'), { recursive: true })
  await writeFile(path.join(jobDir, validationArtifact), `${JSON.stringify(validation, null, 2)}\n`, 'utf8')
  if (!validation.valid) {
    await options.jobs.failStage(job.id, 'validate', {
      message: 'Final GLB validation failed',
      code: 'FINAL_GLB_INVALID',
      details: validation.errors.join('; ')
    })
    throw new Error(`Final GLB validation failed: ${validation.errors.join('; ')}`)
  }
  await options.jobs.completeStage(job.id, 'validate', { artifacts: [validationArtifact] })

  await options.jobs.startStage(job.id, 'export')
  await mkdir(path.join(jobDir, 'artifacts', 'export'), { recursive: true })
  await copyFile(sourcePath, path.join(jobDir, exportArtifact))
  const metadata: FinalArtifactMetadata = {
    schema: 'final-artifact/v1',
    jobId: job.id,
    modelTypeId: job.modelTypeId,
    pipelineSchema: job.schema,
    artifact: exportArtifact,
    validationReport: validationArtifact,
    previewUrl: `/jobs/${job.id}/final.glb`,
    downloadUrl: `/jobs/${job.id}/download`,
    animationClips: validation.animationClips
  }
  await writeFile(path.join(jobDir, metadataArtifact), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
  const completed = await options.jobs.completeStage(job.id, 'export', { artifacts: [exportArtifact, metadataArtifact] })
  return { job: completed, validation, metadata }
}

export async function readFinalArtifact(options: {
  jobId: string
  jobs: BuildJobStore
  buildWorkspace: string
}): Promise<FinalArtifactMetadata> {
  const job = await options.jobs.get(options.jobId)
  if (!job) throw new Error(`Build job not found: ${options.jobId}`)
  if (job.stages.validate.status !== 'completed' || job.stages.export.status !== 'completed') {
    throw new Error('Validated export is not available for this job')
  }
  const artifact = 'artifacts/export/final-artifact.json'
  if (!job.stages.export.artifacts.includes(artifact)) throw new Error(`Export stage is missing metadata artifact ${artifact}`)
  const metadata = JSON.parse(await readFile(path.join(options.buildWorkspace, job.id, artifact), 'utf8')) as FinalArtifactMetadata
  if (metadata.schema !== 'final-artifact/v1') throw new Error('Final artifact metadata does not match final-artifact/v1')
  return metadata
}

export async function readFinalValidation(options: {
  jobId: string
  jobs: BuildJobStore
  buildWorkspace: string
}): Promise<FinalGlbValidation> {
  const metadata = await readFinalArtifact(options)
  const validation = JSON.parse(
    await readFile(path.join(options.buildWorkspace, options.jobId, metadata.validationReport), 'utf8')
  ) as FinalGlbValidation
  if (validation.schema !== 'final-glb-validation/v1') {
    throw new Error('Final validation report does not match final-glb-validation/v1')
  }
  return validation
}
