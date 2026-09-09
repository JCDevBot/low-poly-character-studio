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

test('desktop landing hero owns one dynamic viewport without clipping on short laptops', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /\.landingHero \{[\s\S]*min-height: calc\(100dvh - 72px\)/)
  assert.match(css, /\.landingHeroCopy h1 \{[\s\S]*font-size: clamp\(36px, 3\.7vw, 50px\)/)
  assert.match(css, /@media \(max-height: 760px\) and \(min-width: 992px\)/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.landingHeader \{[\s\S]*min-height: 60px/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.landingHero \{[\s\S]*min-height: calc\(100dvh - 60px\)/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.landingProofStage \{[\s\S]*height: clamp\(350px, 60dvh, 390px\)/)
})

test('application screens keep outer viewport fixed and move overflow into bounded panels', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /@media \(min-width: 861px\)[\s\S]*\.modelCatalog \{[\s\S]*height: 100dvh;[\s\S]*overflow: hidden/)
  assert.match(css, /@media \(min-width: 861px\)[\s\S]*\.modelCatalogGrid,[\s\S]*\.modelTypeDetail \{[\s\S]*overflow: auto/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.guidedStudioTopbar \{[\s\S]*min-height: 52px/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.guidedWorkspaceHeading \{[\s\S]*min-height: 50px/)
  assert.match(css, /@media \(max-height: 760px\)[\s\S]*\.studioApplicationShell \.canvasViewport,[\s\S]*\.studioApplicationShell \.canvas \{[\s\S]*min-height: 220px/)
})

test('responsive reflow stylesheet is loaded after product surface styles', async () => {
  const main = await readFile(mainUrl, 'utf8')
  const landingIndex = main.indexOf("./landing-experience.css")
  const reflowIndex = main.indexOf("./product-responsive-reflow.css")

  assert.ok(landingIndex >= 0)
  assert.ok(reflowIndex > landingIndex)
})