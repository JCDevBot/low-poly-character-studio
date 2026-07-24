import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import os from 'node:os'
import path from 'node:path'
import { BuildJobStore } from './build-jobs.js'
import {
  finalizeHumanoidGlb,
  readFinalArtifact,
  readFinalValidation,
  validateGlbBuffer,
} from './final-artifact.js'

function createGlb(document: Record<string, unknown>) {
  const source = Buffer.from(JSON.stringify(document), 'utf8')
  const paddedLength = Math.ceil(source.length / 4) * 4
  const json = Buffer.alloc(paddedLength, 0x20)
  source.copy(json)
  const buffer = Buffer.alloc(20 + paddedLength)
  buffer.writeUInt32LE(0x46546c67, 0)
  buffer.writeUInt32LE(2, 4)
  buffer.writeUInt32LE(buffer.length, 8)
  buffer.writeUInt32LE(paddedLength, 12)
  buffer.writeUInt32LE(0x4e4f534a, 16)
  json.copy(buffer, 20)
  return buffer
}

const validDocument = {
  asset: { version: '2.0' },
  buffers: [{ byteLength: 12 }],
  meshes: [{ name: 'Body' }],
  materials: [{ name: 'Skin' }],
  skins: [{ name: 'humanoid-basic-v1' }],
  animations: [{ name: 'idle' }, { name: 'walk' }]
}

test('accepts a self-contained animated glTF 2.0 binary', () => {
  const result = validateGlbBuffer(createGlb(validDocument))
  assert.equal(result.valid, true)
  assert.deepEqual(result.animationClips, ['idle', 'walk'])
  assert.equal(result.externalResources.length, 0)
})

test('rejects external resources and missing required rigged content', () => {
  const result = validateGlbBuffer(createGlb({
    asset: { version: '2.0' },
    buffers: [{ uri: 'mesh.bin', byteLength: 12 }],
    images: [{ uri: 'texture.png' }]
  }))
  assert.equal(result.valid, false)
  assert.deepEqual(result.externalResources, ['mesh.bin', 'texture.png'])
  assert.match(result.errors.join(' '), /no meshes/i)
  assert.match(result.errors.join(' '), /no skins/i)
  assert.match(result.errors.join(' '), /no animation clips/i)
})

test('rejects malformed GLB headers', () => {
  const result = validateGlbBuffer(Buffer.from('not-a-glb'))
  assert.equal(result.valid, false)
  assert.match(result.errors[0], /shorter than the required header/i)
})

test('persists a validated export and reloads its metadata and report', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'low-poly-final-artifact-'))
  try {
    const jobs = new BuildJobStore(workspace)
    const job = await jobs.create({ modelTypeId: 'humanoid/chibi-v1', input: null })
    const animateDir = path.join(workspace, job.id, 'artifacts', 'animate')
    await mkdir(animateDir, { recursive: true })
    await writeFile(path.join(animateDir, 'humanoid-animated.glb'), createGlb(validDocument))
    await jobs.startStage(job.id, 'animate')
    await jobs.completeStage(job.id, 'animate', { artifacts: ['artifacts/animate/humanoid-animated.glb'] })

    const finalized = await finalizeHumanoidGlb({ jobId: job.id, jobs, buildWorkspace: workspace })
    assert.equal(finalized.validation.valid, true)
    assert.equal(finalized.job.stages.export.status, 'completed')

    const metadata = await readFinalArtifact({ jobId: job.id, jobs, buildWorkspace: workspace })
    const validation = await readFinalValidation({ jobId: job.id, jobs, buildWorkspace: workspace })
    assert.equal(metadata.jobId, job.id)
    assert.deepEqual(metadata.animationClips, ['idle', 'walk'])
    assert.equal(validation.valid, true)
    assert.equal(validation.skinCount, 1)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
