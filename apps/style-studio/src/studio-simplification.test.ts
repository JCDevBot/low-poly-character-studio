import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cssUrl = new URL('./studio-simplification.css', import.meta.url)
const mainUrl = new URL('./main.tsx', import.meta.url)
const shellUrl = new URL('./StudioShell.tsx', import.meta.url)
const readinessUrl = new URL('./VerticalSliceReadiness.tsx', import.meta.url)

test('marketing page owns a real scroll container instead of clipping lower sections', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /\.landingExperience \{[\s\S]*height: 100dvh;[\s\S]*overflow-y: auto/)
  assert.match(css, /\.landingPipeline \{[\s\S]*scroll-margin-top: 72px/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.landingPipeline \{[\s\S]*padding: 34px 0 26px/)
})

test('large-laptop Studio collapses workflow navigation and keeps task controls beside the canvas', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /@media \(max-width: 1399\.98px\)[\s\S]*\.guidedStudioBody \{[\s\S]*display: block/)
  assert.match(css, /@media \(max-width: 1399\.98px\)[\s\S]*\.guidedStepRail \{[\s\S]*position: fixed/)
  assert.match(css, /@media \(max-width: 1399\.98px\)[\s\S]*\.guidedStudioTopbarActions \.guidedMobileControl,[\s\S]*display: inline-flex/)
  assert.match(css, /\.guidedStudioStep--2 \.referenceWorkspace \.sidebar \.controls,[\s\S]*display: none/)
})

test('Studio chrome has one step heading and readiness appears only at review', async () => {
  const shell = await readFile(shellUrl, 'utf8')
  const readiness = await readFile(readinessUrl, 'utf8')

  assert.doesNotMatch(shell, /className="guidedStudioProgress"/)
  assert.match(shell, /Step \{currentStepIndex \+ 1\} of \{WORKFLOW_STEPS\.length\}/)
  assert.match(shell, /visible=\{currentStepIndex === 3\}/)
  assert.match(readiness, /if \(!visible\) return null/)
  assert.match(readiness, />Confirm character type</)
})

test('simplification overrides load after the earlier responsive stylesheet', async () => {
  const main = await readFile(mainUrl, 'utf8')
  const reflowIndex = main.indexOf("./product-responsive-reflow.css")
  const simplificationIndex = main.indexOf("./studio-simplification.css")

  assert.ok(reflowIndex >= 0)
  assert.ok(simplificationIndex > reflowIndex)
})
