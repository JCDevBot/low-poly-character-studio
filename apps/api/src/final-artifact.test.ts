import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateGlbBuffer } from './final-artifact.js'

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

test('accepts a self-contained animated glTF 2.0 binary', () => {
  const result = validateGlbBuffer(createGlb({
    asset: { version: '2.0' },
    buffers: [{ byteLength: 12 }],
    meshes: [{ name: 'Body' }],
    materials: [{ name: 'Skin' }],
    skins: [{ name: 'humanoid-basic-v1' }],
    animations: [{ name: 'idle' }, { name: 'walk' }]
  }))
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
