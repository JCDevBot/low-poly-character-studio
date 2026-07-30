import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceUrl = new URL('./StudioShell.tsx', import.meta.url)
const cssUrl = new URL('./guided-studio-shell.css', import.meta.url)

test('guided shell exposes the approved seven-step workflow and stable regions', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /Choose character type/)
  assert.match(source, /Add reference images/)
  assert.match(source, /Place markers/)
  assert.match(source, /Review character shape/)
  assert.match(source, /Generate character/)
  assert.match(source, /Rig and animate/)
  assert.match(source, /Review and export/)
  assert.match(source, /guidedStepRail/)
  assert.match(source, /guidedMainWorkspace/)
  assert.match(source, /guidedInspector/)
  assert.match(source, /Guest project/)
})

test('guided shell preserves the working pipeline surfaces', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /VerticalSliceReadinessPanel/)
  assert.match(source, /VerticalSliceBuildWorkflow/)
  assert.match(source, /ReferenceWorkspace/)
  assert.match(source, /<App \/>/)
  assert.match(source, /stepState\(index, buildReady\)/)
})

test('guided shell collapses navigation and inspector without horizontal page flow', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /grid-template-columns: 238px minmax\(0, 1fr\) 300px/)
  assert.match(css, /@media \(max-width: 1180px\)/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /\.guidedStepRail\.isOpen/)
  assert.match(css, /\.guidedInspector\.isOpen/)
  assert.match(css, /overflow: hidden/)
})
