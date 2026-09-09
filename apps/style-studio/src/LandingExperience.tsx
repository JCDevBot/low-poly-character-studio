import { useEffect, useState } from 'react'

interface LandingExperienceProps {
  onContinueAsGuest: () => void
}

const pipelineSteps = ['References', 'Markers', 'Character', 'Rig and motion', 'Validate', 'Export']

export function LandingExperience({ onContinueAsGuest }: LandingExperienceProps) {
  const [entryOpen, setEntryOpen] = useState(false)
  const [signInNotice, setSignInNotice] = useState(false)

  useEffect(() => {
    const targetId = window.location.hash.slice(1)
    if (!targetId) return
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }, [])

  return (
    <main className="landingExperience">
      <header className="landingHeader">
        <a className="landingBrand" href="#top" aria-label="Low Poly Character Studio home">
          <span className="landingBrandMark" aria-hidden="true">LP</span>
          <span>Low Poly Character Studio</span>
        </a>
        <nav className="landingMenu" aria-label="Product navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <button className="landingTextButton" type="button" onClick={() => setSignInNotice(true)}>Sign in</button>
          <button className="landingPrimaryButton" type="button" onClick={() => setEntryOpen(true)}>Continue as guest</button>
        </nav>
      </header>

      <section className="landingHero" id="top">
        <div className="landingHeroCopy">
          <p className="landingEyebrow">Image to animated 3D character</p>
          <h1>Turn a character image into a rigged, animated low-poly asset.</h1>
          <p className="landingLead">
            Add one or more references, guide the character shape, and let the Studio build a validated GLB with a humanoid rig and starter animations.
          </p>
          <div className="landingHeroActions">
            <button className="landingPrimaryButton landingPrimaryButtonLarge" type="button" onClick={() => setEntryOpen(true)}>
              Start creating
            </button>
            <a className="landingSecondaryLink" href="#how-it-works">See how it works</a>
          </div>
        </div>

        <div className="landingProof" id="product" aria-label="Product demonstration placeholder">
          <div className="landingProofStage" role="img" aria-label="Placeholder for a Studio-created character running an obstacle course">
            <div className="landingCourse" aria-hidden="true">
              <span className="landingObstacle landingObstacleOne" />
              <span className="landingObstacle landingObstacleTwo" />
              <span className="landingCharacterDemo">
                <span className="landingCharacterHead" />
                <span className="landingCharacterBody" />
                <span className="landingCharacterLeg landingCharacterLegLeft" />
                <span className="landingCharacterLeg landingCharacterLegRight" />
              </span>
            </div>
            <div className="landingProofCaption">
              <span>Product proof placeholder</span>
              <strong>Studio-created obstacle-course demo will replace this preview.</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landingPipeline" id="how-it-works" aria-labelledby="pipeline-title">
        <p className="landingEyebrow">How it works</p>
        <h2 id="pipeline-title">A guided path from references to a portable character.</h2>
        <ol>
          {pipelineSteps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="landingTiles" aria-label="Product benefits">
        <article>
          <span className="landingTileNumber">01</span>
          <h2>Start with references</h2>
          <p>One front image works. Optional side and back views improve the character interpretation.</p>
        </article>
        <article>
          <span className="landingTileNumber">02</span>
          <h2>Rigged and animated</h2>
          <p>The Studio builds the low-poly character, humanoid skeleton, skinning, and starter motion pack.</p>
        </article>
        <article>
          <span className="landingTileNumber">03</span>
          <h2>Portable output</h2>
          <p>Preview and download one validated GLB that works without repository-specific runtime code.</p>
        </article>
      </section>

      {entryOpen && (
        <div className="landingDialogBackdrop" role="presentation" onMouseDown={() => setEntryOpen(false)}>
          <section className="landingEntryDialog" role="dialog" aria-modal="true" aria-labelledby="entry-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="landingDialogClose" type="button" aria-label="Close entry options" onClick={() => setEntryOpen(false)}>×</button>
            <p className="landingEyebrow">Start a project</p>
            <h2 id="entry-title">How would you like to continue?</h2>
            <p>Guest mode uses the current local workflow. Account-based project saving is not available yet.</p>
            <button className="landingPrimaryButton landingEntryChoice" type="button" onClick={onContinueAsGuest}>
              <strong>Continue as guest</strong>
              <span>Open a local guest project now.</span>
            </button>
            <button className="landingSignInChoice" type="button" onClick={() => setSignInNotice(true)}>
              <strong>Sign in</strong>
              <span>Project accounts are coming later.</span>
            </button>
          </section>
        </div>
      )}

      {signInNotice && (
        <div className="landingNotice" role="status">
          <span>Account sign-in is not available yet. Continue as a guest to use the local Studio.</span>
          <button type="button" onClick={() => setSignInNotice(false)}>Dismiss</button>
        </div>
      )}
    </main>
  )
}
