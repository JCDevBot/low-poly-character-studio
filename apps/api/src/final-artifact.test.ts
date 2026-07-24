import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
  const binary = Buffer.from([1, 2, 3, 4])
  const buffer = Buffer.alloc(28 + paddedLength + binary.length)
  buffer.writeUInt32LE(0x46546c67, 0)
  buffer.writeUInt32LE(2, 4)
  buffer.writeUInt32LE(buffer.length, 8)
  buffer.writeUInt32LE(paddedLength, 12)
  buffer.writeUInt32LE(0x4e4f534a, 16)
  json.copy(buffer, 20)
  const binaryHeader = 20 + paddedLength
  buffer.writeUInt32LE(binary.length, binaryHeader)
  buffer.writeUInt32LE(0x004e4942, binaryHeader + 4)
  binary.copy(buffer, binaryHeader + 8)
  return buffer
}

const validDocument = {
  asset: { version: '2.0' },
  buffers: [{ byteLength: 4 }],
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
  assert.equal(result.embeddedMetadata, null)
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

test('persists a validated export with embedded build provenance', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'low-poly-final-artifact-'))
  try {
    const jobs = new BuildJobStore(workspace)
    const job = await jobs.create({
      modelTypeId: 'humanoid/chibi-v1',
      input: {
        styleDna: { schema: 'humanoid-style-dna/v1' },
        generationSettings: { quality: 'preview' }
      }
    })
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
    const exported = await readFile(path.join(workspace, job.id, metadata.artifact))
    const revalidated = validateGlbBuffer(exported, metadata.artifact, validation.embeddedMetadata ?? undefined)

    assert.equal(metadata.jobId, job.id)
    assert.deepEqual(metadata.animationClips, ['idle', 'walk'])
    assert.equal(validation.valid, true)
    assert.equal(validation.skinCount, 1)
    assert.equal(validation.embeddedMetadata?.jobId, job.id)
    assert.equal(validation.embeddedMetadata?.modelTypeId, 'humanoid/chibi-v1')
    assert.equal(validation.embeddedMetadata?.pipelineSchema, 'build-job/v1')
    assert.equal(validation.embeddedMetadata?.styleDnaSchema, 'humanoid-style-dna/v1')
    assert.deepEqual(validation.embeddedMetadata?.generationSettings, { quality: 'preview' })
    assert.equal(revalidated.valid, true)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
