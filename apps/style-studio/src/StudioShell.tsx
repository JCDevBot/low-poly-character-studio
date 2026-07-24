import React, { useEffect, useState } from 'react'
import type { ModelTypeManifest } from '../../../packages/model-types/src/types'
import { App } from './App'
import { FinalBuildWorkflow } from './FinalBuildWorkflow'
import { ModelTypeCatalog } from './ModelTypeCatalog'
import { ReferenceWorkspace } from './ReferenceWorkspace'

function StudioShell() {
  const [selected, setSelected] = useState<ModelTypeManifest | null>(null)

  useEffect(() => {
    if (!selected) return
    localStorage.setItem('low-poly-character-studio.model-type.v1', selected.id)
    window.dispatchEvent(new CustomEvent('low-poly:model-type-selected', { detail: selected }))
  }, [selected])

  if (!selected) return <ModelTypeCatalog onSelect={setSelected} />

  return (
    <div className="catalogSelectedWorkflow">
      <div className="catalogReturnBar">
        <span><strong>{selected.name}</strong> · {selected.id}</span>
        <button type="button" onClick={() => setSelected(null)}>Change model type</button>
      </div>
      <ReferenceWorkspace>
        <App />
        <FinalBuildWorkflow modelTypeId={selected.id} />
      </ReferenceWorkspace>
    </div>
  )
}

export { StudioShell }
