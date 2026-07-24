import assert from 'node:assert/strict'
import test from 'node:test'
import { selectLatestAnimatedJob, type BuildJob } from './AnimationClipCatalog'

function job(id: string, createdAt: string, status: BuildJob['stages']['animate']['status']): BuildJob {
  return {
    id,
    createdAt,
    modelTypeId: 'humanoid/chibi-v1',
    stages: { animate: { status } },
  }
}

test('selectLatestAnimatedJob returns the newest completed animate-stage job', () => {
  const selected = selectLatestAnimatedJob([
    job('older-complete', '2026-07-20T12:00:00.000Z', 'completed'),
    job('newer-failed', '2026-07-23T12:00:00.000Z', 'failed'),
    job('newest-complete', '2026-07-22T12:00:00.000Z', 'completed'),
  ])

  assert.equal(selected?.id, 'newest-complete')
})

test('selectLatestAnimatedJob returns null without completed animation artifacts', () => {
  assert.equal(selectLatestAnimatedJob([
    job('pending', '2026-07-22T12:00:00.000Z', 'pending'),
    job('running', '2026-07-23T12:00:00.000Z', 'running'),
  ]), null)
})
