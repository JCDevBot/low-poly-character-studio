import React, { useEffect, useMemo, useState } from 'react'
import type { ModelTypeManifest } from '../../../packages/model-types/src/types'
import {
  ANALYSIS_STORAGE_KEY,
  CONFIRMATION_STORAGE_KEY,
  REFERENCE_SET_STORAGE_KEY,
  createModelTypeConfirmation,
  deriveVerticalSliceReadiness,
  enrichReferenceSet,
  parseStored,
  type ModelTypeConfirmation,
  type ReferenceAnalysis,
  type ReferenceSet,
  type VerticalSliceReadiness,
} from './vertical-slice-readiness'

type Props = {
  modelType: ModelTypeManifest
  onReadinessChange: (readiness: VerticalSliceReadiness) => void
}

function readState() {
  return {
    referenceSet: parseStored<ReferenceSet>(localStorage.getItem(REFERENCE_SET_STORAGE_KEY)),
    analysis: parseStored<ReferenceAnalysis>(localStorage.getItem(ANALYSIS_STORAGE_KEY)),
    confirmation: parseStored<ModelTypeConfirmation>(localStorage.getItem(CONFIRMATION_STORAGE_KEY)),
  }
}

function VerticalSliceReadinessPanel({ modelType, onReadinessChange }: Props) {
  const [state, setState] = useState(readState)
  const readiness = useMemo(
    () => deriveVerticalSliceReadiness(modelType.id, state.referenceSet, state.analysis, state.confirmation),
    [modelType.id, state],
  )

  useEffect(() => onReadinessChange(readiness), [onReadinessChange, readiness])

  useEffect(() => {
    const refresh = () => setState(readState())
    window.addEventListener('low-poly:reference-set-change', refresh)
    window.addEventListener('low-poly:reference-analysis-complete', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('low-poly:reference-set-change', refresh)
      window.removeEventListener('low-poly:reference-analysis-complete', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    if (!state.confirmation || state.confirmation.modelTypeId === modelType.id) return
    localStorage.removeItem(CONFIRMATION_STORAGE_KEY)
    setState((current) => ({ ...current, confirmation: null }))
  }, [modelType.id, state.confirmation])

  function confirmModelType() {
    if (!state.referenceSet || !state.analysis) return
    const confirmation = createModelTypeConfirmation(modelType.id)
    const enriched = enrichReferenceSet(state.referenceSet, state.analysis, confirmation)
    localStorage.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(confirmation))
    localStorage.setItem(REFERENCE_SET_STORAGE_KEY, JSON.stringify(enriched))
    setState({ referenceSet: enriched, analysis: state.analysis, confirmation })
    window.dispatchEvent(new CustomEvent('low-poly:model-type-confirmed', { detail: confirmation }))
  }

  const confidence = state.analysis?.confidence?.overall
  const expectedParts = modelType.expectedParts.filter((part) => part.required)

  return (
    <section className="verticalSliceReadiness" aria-labelledby="vertical-slice-readiness-title">
      <div className="verticalSliceReadinessHeading">
        <div>
          <strong id="vertical-slice-readiness-title">Gold-standard build readiness</strong>
          <small>Reference → analysis → model confirmation → persisted build</small>
        </div>
        <span data-ready={readiness.ready}>{readiness.ready ? 'Ready to build' : 'Setup required'}</span>
      </div>

      <ol className="verticalSliceReadinessSteps">
        <li data-complete={readiness.hasFrontReference}><strong>1</strong><span>Front reference</span></li>
        <li data-complete={readiness.hasAnalysis}><strong>2</strong><span>Analysis</span></li>
        <li data-complete={readiness.modelTypeConfirmed}><strong>3</strong><span>Confirm model type</span></li>
      </ol>

      <div className="verticalSliceReadinessBody">
        <div>
          <p><strong>Recommended:</strong> {modelType.name} <code>{modelType.id}</code></p>
          <p>{modelType.description}</p>
          <p><strong>Required parts:</strong> {expectedParts.map((part) => part.label).join(', ')}</p>
          {typeof confidence === 'number' ? (
            <p><strong>Analysis confidence:</strong> {Math.round(confidence * 100)}% {state.analysis?.confidence?.level ?? ''}</p>
          ) : null}
          {state.analysis?.warnings?.map((warning) => <p className="verticalSliceWarning" key={warning.code}>{warning.message}</p>)}
        </div>

        <div className="verticalSliceConfirmation">
          <button
            type="button"
            className="primary"
            onClick={confirmModelType}
            disabled={!readiness.hasFrontReference || !readiness.hasAnalysis || readiness.modelTypeConfirmed}
          >
            {readiness.modelTypeConfirmed ? `${modelType.name} confirmed` : `Confirm ${modelType.name}`}
          </button>
          {!readiness.ready ? <ul>{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : (
            <p role="status">The validated build action is enabled. Editable landmarks become the StyleDNA source.</p>
          )}
        </div>
      </div>

      {state.analysis?.colorRegions?.length ? (
        <details>
          <summary>Analysis artifacts</summary>
          <dl className="verticalSliceAnalysisGrid">
            <div><dt>Adapter</dt><dd>{state.analysis.adapterId ?? 'unknown'}</dd></div>
            <div><dt>Schema</dt><dd>{state.analysis.schemaVersion ?? 'unknown'}</dd></div>
            {state.analysis.colorRegions.map((region) => (
              <div key={region.name}><dt>{region.name}</dt><dd>rgb({region.rgb.join(', ')}) · {region.sampleCount} samples</dd></div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  )
}

export { VerticalSliceReadinessPanel }
