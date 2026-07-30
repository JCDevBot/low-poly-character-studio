import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cssUrl = new URL('./product-responsive-reflow.css', import.meta.url)
const mainUrl = new URL('./main.tsx', import.meta.url)

test('product surfaces reflow at Bootstrap-style XXL and LG breakpoints', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /@media \(max-width: 1399\.98px\)/)
  assert.match(css, /@media \(max-width: 1399\.98px\)[\s\S]*\.guidedStudioBody \{[\s\S]*grid-template-columns: 210px minmax\(0, 1fr\)/)
  assert.match(css, /@media \(max-width: 1399\.98px\)[\s\S]*\.guidedInspector \{[\s\S]*position: fixed/)
  assert.match(css, /@media \(max-width: 991\.98px\)[\s\S]*\.guidedStudioBody \{[\s\S]*display: block/)
  assert.match(css, /@media \(max-width: 991\.98px\)[\s\S]*\.guidedStepRail \{[\s\S]*position: fixed/)
})

test('large-laptop and short-viewport landing layouts reduce hero crowding', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /\.landingHeroCopy h1 \{[\s\S]*font-size: clamp\(40px, 5vw, 64px\)/)
  assert.match(css, /@media \(max-height: 760px\) and \(min-width: 992px\)/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.landingProofStage \{[\s\S]*min-height: clamp\(390px, 62vh, 500px\)/)
})

test('responsive reflow stylesheet is loaded after product surface styles', async () => {
  const main = await readFile(mainUrl, 'utf8')
  const landingIndex = main.indexOf("./landing-experience.css")
  const reflowIndex = main.indexOf("./product-responsive-reflow.css")

  assert.ok(landingIndex >= 0)
  assert.ok(reflowIndex > landingIndex)
})
