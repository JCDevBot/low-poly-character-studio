import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(path.join(import.meta.dirname, 'VerticalSliceBuildWorkflow.tsx'), 'utf8')
const shell = fs.readFileSync(path.join(import.meta.dirname, 'StudioShell.tsx'), 'utf8')

test('Studio launches the complete persisted pipeline from one action', () => {
  assert.match(source, /`\/jobs\/\$\{created\.job\.id\}\/run`/)
  assert.match(source, /modelTypeConfirmation/)
  assert.match(source, /referenceSet/)
  assert.match(source, /analysis/)
  assert.match(source, /styleDna/)
})

test('completed result exposes stages, preview, clips, validation, and download', () => {
  for (const stage of ['model', 'rig', 'animate', 'validate', 'export']) assert.match(source, new RegExp(`['"]${stage}['"]`))
  assert.match(source, /Preview url=/)
  assert.match(source, /animationClips\.map/)
  assert.match(source, /validation\.valid/)
  assert.match(source, /downloadUrl/)
})

test('Studio uses the vertical-slice workflow only after readiness', () => {
  assert.match(shell, /buildReady \? <VerticalSliceBuildWorkflow modelTypeId=\{selected\.id\} \/> : null/)
  assert.doesNotMatch(shell, /<FinalBuildWorkflow/)
})
