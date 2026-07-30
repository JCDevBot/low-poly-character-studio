import React, { useEffect, useMemo, useState } from 'react'
import { modelTypeRegistry } from '../../../packages/model-types/src/registry'
import type { ModelTypeManifest } from '../../../packages/model-types/src/types'
import { App } from './App'
import { ModelTypeCatalog } from './ModelTypeCatalog'
import { ReferenceWorkspace } from './ReferenceWorkspace'
import { VerticalSliceBuildWorkflow } from './VerticalSliceBuildWorkflow'
import { VerticalSliceReadinessPanel } from './VerticalSliceReadiness'
import './responsive-studio.css'
import './responsive-studio-mobile.css'
import './vertical-slice-readiness.css'
import './guided-studio-shell.css'

const MODEL_TYPE_STORAGE_KEY = 'low-poly-character-studio.model-type.v1'

const WORKFLOW_STEPS = [
  'Choose character type',
  'Add reference images',
  'Place markers',
  'Review character shape',
  'Generate character',
  'Rig and animate',
  'Review and export',
] as const

type WorkflowStep = typeof WORKFLOW_STEPS[number]
type StepState = 'completed' | 'current' | 'available' | 'warning' | 'future'

function initialModelType(): ModelTypeManifest | null {
  const requestedId = new URLSearchParams(window.location.search).get('modelType')
    ?? localStorage.getItem(MODEL_TYPE_STORAGE_KEY)
  return requestedId ? modelTypeRegistry.get(requestedId) ?? null : null
}

function stepState(index: number, buildReady: boolean): StepState {
  if (index === 0) return 'completed'
  if (!buildReady) {
    if (index === 1) return 'current'
    if (index === 2) return 'available'
    return 'future'
  }
  if (index <= 3) return 'completed'
  if (index === 4) return 'current'
  if (index === 5) return 'available'
  return 'future'
}

function inspectorCopy(step: WorkflowStep, buildReady: boolean) {
  if (step === 'Add reference images') {
    return {
      title: 'Reference guidance',
      body: 'Add a clear front image first. Side and back views are optional and improve fidelity.',
    }
  }
  if (step === 'Generate character' && buildReady) {
    return {
      title: 'Ready to generate',
      body: 'Your confirmed reference and character shape are ready for the modeling pipeline.',
    }
  }
  return {
    title: 'Project guidance',
    body: 'Complete the current step to unlock the next part of the character workflow.',
  }
}

function StudioShell() {
  const [selected, setSelected] = useState<ModelTypeManifest | null>(initialModelType)
  const [buildReady, setBuildReady] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  useEffect(() => {
    if (!selected) return
    localStorage.setItem(MODEL_TYPE_STORAGE_KEY, selected.id)
    window.dispatchEvent(new CustomEvent('low-poly:model-type-selected', { detail: selected }))
    setBuildReady(false)
  }, [selected])

  const currentStepIndex = buildReady ? 4 : 1
  const currentStep = WORKFLOW_STEPS[currentStepIndex]
  const inspector = useMemo(() => inspectorCopy(currentStep, buildReady), [currentStep, buildReady])

  if (!selected) return <ModelTypeCatalog onSelect={setSelected} />

  return (
    <div className="guidedStudioShell studioApplicationShell">
      <header className="guidedStudioTopbar">
        <div className="guidedStudioBrand">
          <strong>Low Poly Character Studio</strong>
          <span>Guest project</span>
        </div>
        <div className="guidedStudioProgress" aria-live="polite">
          <strong>{currentStep}</strong>
          <span>Step {currentStepIndex + 1} of {WORKFLOW_STEPS.length}</span>
        </div>
        <div className="guidedStudioTopbarActions">
          <button type="button" className="guidedMobileControl" aria-expanded={stepsOpen} onClick={() => setStepsOpen((open) => !open)}>Steps</button>
          <button type="button" className="guidedMobileControl" aria-expanded={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}>Guidance</button>
          <button type="button" onClick={() => setSelected(null)}>Change type</button>
        </div>
      </header>

      <div className="guidedStudioBody">
        <nav className={`guidedStepRail ${stepsOpen ? 'isOpen' : ''}`} aria-label="Character workflow">
          <div className="guidedRailHeading">
            <span>Workflow</span>
            <button type="button" className="guidedDrawerClose" onClick={() => setStepsOpen(false)}>Close</button>
          </div>
          <ol>
            {WORKFLOW_STEPS.map((step, index) => {
              const state = stepState(index, buildReady)
              return (
                <li key={step} className={`guidedStep guidedStep--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="guidedStepNumber">{state === 'completed' ? '✓' : index + 1}</span>
                  <span><strong>{step}</strong><small>{state}</small></span>
                </li>
              )
            })}
          </ol>
        </nav>

        <main className="guidedMainWorkspace">
          <div className="guidedWorkspaceHeading">
            <div>
              <span className="guidedEyebrow">{selected.name}</span>
              <h1>{currentStep}</h1>
            </div>
            <div className="guidedPrimaryAction">
              {buildReady ? (
                <VerticalSliceBuildWorkflow modelTypeId={selected.id} />
              ) : (
                <button type="button" disabled title="Add and analyze a front reference, then confirm the model type">Generate character · setup required</button>
              )}
            </div>
          </div>

          <VerticalSliceReadinessPanel modelType={selected} onReadinessChange={(readiness) => setBuildReady(readiness.ready)} />
          <ReferenceWorkspace>
            <App />
          </ReferenceWorkspace>
        </main>

        <aside className={`guidedInspector ${inspectorOpen ? 'isOpen' : ''}`} aria-label="Step guidance">
          <div className="guidedRailHeading">
            <span>Inspector</span>
            <button type="button" className="guidedDrawerClose" onClick={() => setInspectorOpen(false)}>Close</button>
          </div>
          <section>
            <span className="guidedEyebrow">Current step</span>
            <h2>{inspector.title}</h2>
            <p>{inspector.body}</p>
          </section>
          <section>
            <h3>Character type</h3>
            <p><strong>{selected.name}</strong></p>
            <p>{selected.id}</p>
          </section>
          <details>
            <summary>Advanced project details</summary>
            <p>Technical artifacts and diagnostics remain available inside the existing workflow when their prerequisites are complete.</p>
          </details>
        </aside>
      </div>
    </div>
  )
}

export { StudioShell }
