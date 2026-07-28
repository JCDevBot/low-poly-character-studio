import React from 'react'
import { createRoot } from 'react-dom/client'
import { StudioShell } from './StudioShell'
import { installCanvasNativeScroll } from './canvas-native-scroll'
import './styles.css'
import './canvas-native-scroll.css'

installCanvasNativeScroll()

createRoot(document.getElementById('root')!).render(<StudioShell />)
