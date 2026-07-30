import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LandingExperience } from './LandingExperience'
import { StudioShell } from './StudioShell'
import { installCanvasNativeScroll } from './canvas-native-scroll'
import './styles.css'
import './canvas-native-scroll.css'
import './landing-experience.css'
import './guided-generation-workflow.css'
import './product-responsive-reflow.css'

installCanvasNativeScroll()

function App() {
  const [guestStarted, setGuestStarted] = useState(false)

  if (guestStarted) {
    return <StudioShell />
  }

  return <LandingExperience onContinueAsGuest={() => setGuestStarted(true)} />
}

createRoot(document.getElementById('root')!).render(<App />)
