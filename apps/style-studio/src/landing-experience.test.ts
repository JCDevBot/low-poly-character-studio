import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceUrl = new URL('./LandingExperience.tsx', import.meta.url)
const cssUrl = new URL('./landing-experience.css', import.meta.url)
const mainUrl = new URL('./main.tsx', import.meta.url)

test('landing page communicates the product and approved proof structure', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /Turn a character image into a rigged, animated low-poly asset/)
  assert.match(source, /Studio-created character running an obstacle course/)
  assert.match(source, /Start with references/)
  assert.match(source, /Rigged and animated/)
  assert.match(source, /Portable output/)
  assert.match(source, /References.*Markers.*Character.*Rig and motion.*Validate.*Export/s)
})

test('guest entry opens the existing Studio and sign in explains its current state', async () => {
  const [source, main] = await Promise.all([
    readFile(sourceUrl, 'utf8'),
    readFile(mainUrl, 'utf8'),
  ])

  assert.match(source, /Continue as guest/)
  assert.match(source, /Account sign-in is not available yet/)
  assert.match(source, /onContinueAsGuest/)
  assert.match(main, /guestStarted/)
  assert.match(main, /return <StudioShell \/>/)
  assert.match(main, /LandingExperience onContinueAsGuest/)
})

test('landing experience includes responsive and reduced-motion contracts', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /@media \(max-width: 980px\)/)
  assert.match(css, /@media \(max-width: 680px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /\.landingExperience \{[\s\S]*overflow: auto/)
  assert.match(css, /\.landingDialogBackdrop \{[\s\S]*position: fixed/)
})
