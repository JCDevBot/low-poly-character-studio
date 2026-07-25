import React, { useEffect, useState } from 'react'
import { modelTypeRegistry } from '../../../packages/model-types/src/registry'
import type { ModelTypeManifest } from '../../../packages/model-types/src/types'
import { App } from './App'
import { FinalBuildWorkflow } from './FinalBuildWorkflow'
import { ModelTypeCatalog } from './ModelTypeCatalog'
import { ReferenceWorkspace } from './ReferenceWorkspace'
import './responsive-studio.css'

const MODEL_TYPE_STORAGE_KEY = 'low-poly-character-studio.model-type.v1'

function initialModelType(): ModelTypeManifest | null {
  const requestedId = new URLSearchParams(window.location.search).get('modelType')
    ?? localStorage.getItem(MODEL_TYPE_STORAGE_KEY)
  return requestedId ? modelTypeRegistry.get(requestedId) ?? null : null
}

function StudioShell() {
  const [selected, setSelected] = useState<ModelTypeManifest | null>(initialModelType)

  useEffect(() => {
    if (!selected) return
    localStorage.setItem(MODEL_TYPE_STORAGE_KEY, selected.id)
    window.dispatchEvent(new CustomEvent('low-poly:model-type-selected', { detail: selected }))
  }, [selected])

  if (!selected) return <ModelTypeCatalog onSelect={setSelected} />

  return (
    <div className="catalogSelectedWorkflow studioApplicationShell">
      <header className="catalogReturnBar studioGlobalHeader">
        <span className="studioModelIdentity"><strong>{selected.name}</strong><small>{selected.id}</small></span>
        <div className="studioGlobalActions">
          <FinalBuildWorkflow modelTypeId={selected.id} />
          <button type="button" onClick={() => setSelected(null)}>Change model type</button>
        </div>
      </header>
      <ReferenceWorkspace>
        <App />
      </ReferenceWorkspace>
    </div>
  )
}

export { StudioShell }
