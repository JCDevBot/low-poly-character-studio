import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cssUrl = new URL('./responsive-studio.css', import.meta.url)
const breakpointCssUrl = new URL('./responsive-breakpoints.css', import.meta.url)
const shellUrl = new URL('./StudioShell.tsx', import.meta.url)
const referenceWorkspaceUrl = new URL('./ReferenceWorkspace.tsx', import.meta.url)
const canvasScrollCssUrl = new URL('./canvas-native-scroll.css', import.meta.url)
const canvasScrollSourceUrl = new URL('./canvas-native-scroll.ts', import.meta.url)
const mainUrl = new URL('./main.tsx', import.meta.url)


test('Studio shell keeps guided build work in the dominant workspace', async () => {
  const source = await readFile(shellUrl, 'utf8')
  assert.match(source, /guidedStudioTopbar/)
  assert.match(source, /guidedMainWorkspace[\s\S]*VerticalSliceBuildWorkflow/)
  assert.match(source, /isReferenceStep \? <>[\s\S]*ReferenceWorkspace/)
  assert.doesNotMatch(source, /guidedPrimaryAction/)
})

test('Studio shell restores a registered model type from URL or local storage', async () => {
  const source = await readFile(shellUrl, 'utf8')
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\('modelType'\)/)
  assert.match(source, /modelTypeRegistry\.get\(requestedId\)/)
  assert.match(source, /localStorage\.getItem\(MODEL_TYPE_STORAGE_KEY\)/)
})

test('responsive contract makes the viewport first at desktop, tablet, and mobile widths', async () => {
  const css = await readFile(cssUrl, 'utf8')
  assert.match(css, /grid-template-columns: minmax\(210px, 250px\) minmax\(0, 1fr\) minmax\(280px, 340px\)/)
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*\.workspace[\s\S]*grid-row: 1/)
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*grid-template-rows: minmax\(62dvh, 1fr\) auto auto/)
})

test('guided shell uses Bootstrap-style breakpoints to progressively release workspace width', async () => {
  const css = await readFile(breakpointCssUrl, 'utf8')
  assert.match(css, /@media \(max-width: 1399\.98px\)[\s\S]*grid-template-columns: 220px minmax\(0, 1fr\)[\s\S]*\.guidedInspector[\s\S]*position: fixed/)
  assert.match(css, /@media \(max-width: 1199\.98px\)[\s\S]*\.guidedStudioBody[\s\S]*display: block[\s\S]*\.guidedStepRail[\s\S]*position: fixed/)
  assert.match(css, /@media \(max-width: 767\.98px\)[\s\S]*\.guidedStudioProgress[\s\S]*display: none/)
  assert.match(css, /@media \(max-width: 575\.98px\)[\s\S]*\.guidedStudioTopbar/)
})

test('landing experience reflows before laptop and tablet layouts become cramped', async () => {
  const [css, main] = await Promise.all([
    readFile(breakpointCssUrl, 'utf8'),
    readFile(mainUrl, 'utf8'),
  ])
  assert.match(main, /import '\.\/responsive-breakpoints\.css'/)
  assert.match(css, /@media \(max-width: 1399\.98px\)[\s\S]*\.landingHero[\s\S]*minmax\(380px, 1\.05fr\)/)
  assert.match(css, /@media \(max-width: 1199\.98px\)[\s\S]*\.landingHero[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /@media \(max-width: 991\.98px\)[\s\S]*\.landingMenu > a/)
  assert.match(css, /@media \(max-width: 767\.98px\)[\s\S]*\.landingTiles[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
})

test('reference and final-build surfaces do not consume permanent viewport layout space', async () => {
  const css = await readFile(cssUrl, 'utf8')
  assert.match(css, /\.referenceManager \{[\s\S]*position: absolute/)
  assert.match(css, /\.finalWorkflowLauncher \{[\s\S]*position: static/)
  assert.match(css, /overflow: auto/)
  assert.match(css, /overscroll-behavior: contain/)
})

test('reference drawer starts collapsed and supports a reproducible expanded review URL', async () => {
  const source = await readFile(referenceWorkspaceUrl, 'utf8')
  assert.match(source, /get\('references'\) !== 'open'/)
  assert.match(source, /useState\(referenceDrawerInitiallyCollapsed\)/)
  assert.match(source, /collapsed \? 'referenceManager collapsed' : 'referenceManager'/)
})

test('zoomed references remain reachable through native canvas scrolling', async () => {
  const [css, source, main] = await Promise.all([
    readFile(canvasScrollCssUrl, 'utf8'),
    readFile(canvasScrollSourceUrl, 'utf8'),
    readFile(mainUrl, 'utf8'),
  ])

  assert.match(css, /\.canvas \{[\s\S]*overflow: auto/)
  assert.match(css, /\.canvas \.imageLayer \{[\s\S]*position: relative/)
  assert.match(source, /if \(event\.ctrlKey \|\| event\.metaKey\) return/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.match(source, /capture: true/)
  assert.match(main, /installCanvasNativeScroll\(\)/)
})
