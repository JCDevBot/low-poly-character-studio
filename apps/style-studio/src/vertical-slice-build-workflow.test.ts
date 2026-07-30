import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(path.join(import.meta.dirname, 'VerticalSliceBuildWorkflow.tsx'), 'utf8')
const shell = fs.readFileSync(path.join(import.meta.dirname, 'StudioShell.tsx'), 'utf8')


test('Studio launches the complete persisted pipeline from one guided action', () => {
  assert.match(source, /`\/jobs\/\$\{created\.job\.id\}\/run`/)
  assert.match(source, /modelTypeConfirmation/)
  assert.match(source, /referenceSet/)
  assert.match(source, /analysis/)
  assert.match(source, /styleDna/)
  assert.match(source, />Generate character</)
})

test('guided build maps generation, rigging, and final review to plain-language steps', () => {
  assert.match(source, /activeStep === 'generate'/)
  assert.match(source, /activeStep === 'rig'/)
  assert.match(source, /onStepChange\('review'\)/)
  assert.match(source, /Character complete/)
  assert.match(source, /Download validated GLB/)
  assert.doesNotMatch(source, /Gold-standard vertical slice/)
})

test('completed result exposes stages, largest preview, clips, validation, and guarded download', () => {
  for (const stage of ['model', 'rig', 'animate', 'validate', 'export']) assert.match(source, new RegExp(`['"]${stage}['"]`))
  assert.match(source, /Preview url=/)
  assert.match(source, /animationClips\.map/)
  assert.match(source, /result\.validation\.valid \? <a/)
  assert.match(source, /downloadUrl/)
  assert.match(source, /Advanced build details/)
})

test('Studio mounts guided generation only after reference readiness', () => {
  assert.match(shell, /isReferenceStep \? <>/)
  assert.match(shell, /activeStep=\{buildStep\}/)
  assert.match(shell, /onStepChange=\{setBuildStep\}/)
  assert.doesNotMatch(shell, /<FinalBuildWorkflow/)
})
