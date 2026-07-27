import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createModelTypeConfirmation,
  deriveVerticalSliceReadiness,
  enrichReferenceSet,
} from './vertical-slice-readiness'

const modelTypeId = 'humanoid/chibi-v1'
const referenceSet = {
  schemaVersion: 'reference-set/v1',
  modelTypeId,
  references: { front: { fileName: 'gold-standard-humanoid-chibi.png' } },
}
const analysis = {
  schemaVersion: 'humanoid-reference-analysis/v1',
  modelTypeId,
  adapterId: 'humanoid/chibi-local-silhouette-v1',
  confidence: { overall: 0.8, level: 'high' },
  colorRegions: [],
  warnings: [],
}

test('requires a front reference, analysis, and explicit model confirmation', () => {
  assert.deepEqual(
    deriveVerticalSliceReadiness(modelTypeId, null, null, null).reasons,
    ['Add a front reference image.', 'Analyze the front reference.', `Confirm ${modelTypeId} before generation.`],
  )

  const confirmation = createModelTypeConfirmation(modelTypeId, '2026-07-27T00:00:00.000Z')
  const ready = deriveVerticalSliceReadiness(modelTypeId, referenceSet, analysis, confirmation)
  assert.equal(ready.ready, true)
  assert.equal(ready.hasFrontReference, true)
  assert.equal(ready.hasAnalysis, true)
  assert.equal(ready.modelTypeConfirmed, true)
})

test('rejects confirmation for a different model type', () => {
  const confirmation = createModelTypeConfirmation('quadruped/planned-v0')
  const readiness = deriveVerticalSliceReadiness(modelTypeId, referenceSet, analysis, confirmation)
  assert.equal(readiness.ready, false)
  assert.equal(readiness.modelTypeConfirmed, false)
})

test('persists analysis and confirmation with the reference job input', () => {
  const confirmation = createModelTypeConfirmation(modelTypeId, '2026-07-27T00:00:00.000Z')
  const enriched = enrichReferenceSet(referenceSet, analysis, confirmation)
  assert.equal(enriched.analysis, analysis)
  assert.equal(enriched.modelTypeConfirmation, confirmation)
  assert.equal(enriched.references?.front, referenceSet.references.front)
})
