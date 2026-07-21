import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ReferenceWorkspace } from './ReferenceWorkspace'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <ReferenceWorkspace>
    <App />
  </ReferenceWorkspace>
)
