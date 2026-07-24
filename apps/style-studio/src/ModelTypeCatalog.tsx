import React, { useMemo, useState } from 'react'
import { modelTypeRegistry } from '../../../packages/model-types/src/registry'
import type { ModelTypeManifest } from '../../../packages/model-types/src/types'
import './model-type-catalog.css'

function capabilityLabels(manifest: ModelTypeManifest) {
  return [
    manifest.capabilities.materials ? 'Materials' : null,
    manifest.capabilities.rigged ? 'Rigged' : null,
    manifest.capabilities.animated ? 'Animated' : null,
    ...manifest.output.map((format) => format.toUpperCase()),
  ].filter((label): label is string => Boolean(label))
}

function ModelTypeCatalog({ onSelect }: { onSelect: (manifest: ModelTypeManifest) => void }) {
  const manifests = useMemo(() => modelTypeRegistry.list(), [])
  const [selectedId, setSelectedId] = useState(manifests[0]?.id ?? '')
  const selected = manifests.find((manifest) => manifest.id === selectedId) ?? manifests[0]

  if (!selected) return <p>No model types are registered.</p>

  return (
    <main className="modelCatalog">
      <header className="modelCatalogHero">
        <div>
          <span className="modelCatalogEyebrow">Low Poly Character Studio</span>
          <h1>Choose a model type</h1>
          <p>Reference requirements and pipeline capabilities come directly from the shared model type registry.</p>
        </div>
      </header>

      <div className="modelCatalogLayout">
        <section className="modelCatalogGrid" aria-label="Model types">
          {manifests.map((manifest) => (
            <button
              key={manifest.id}
              type="button"
              className={manifest.id === selected.id ? 'modelTypeCard selected' : 'modelTypeCard'}
              onClick={() => setSelectedId(manifest.id)}
              aria-pressed={manifest.id === selected.id}
            >
              <span className={`modelStatus ${manifest.status}`}>{manifest.status}</span>
              <strong>{manifest.name}</strong>
              <small>{manifest.id} · v{manifest.version}</small>
              <p>{manifest.description}</p>
              <span className="modelCapabilityRow">
                {capabilityLabels(manifest).map((label) => <span key={label}>{label}</span>)}
              </span>
            </button>
          ))}
        </section>

        <aside className="modelTypeDetail" aria-label={`${selected.name} details`}>
          <div className="modelTypeDetailHeading">
            <div>
              <span className={`modelStatus ${selected.status}`}>{selected.status}</span>
              <h2>{selected.name}</h2>
              <code>{selected.id}</code>
            </div>
            <button
              type="button"
              className="startModelButton"
              disabled={selected.status !== 'available'}
              onClick={() => onSelect(selected)}
            >
              {selected.status === 'available' ? 'Start with this model' : `${selected.status} model`}
            </button>
          </div>

          <section>
            <h3>Reference images</h3>
            <ul className="modelReferenceList">
              {selected.referenceSlots.map((slot) => (
                <li key={slot.id}>
                  <strong>{slot.label}</strong>
                  <span>{slot.required ? 'Required' : 'Optional'}</span>
                  {slot.description ? <p>{slot.description}</p> : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Pipeline</h3>
            <dl className="modelFacts">
              <div><dt>Rig</dt><dd>{selected.rig ?? 'Not available'}</dd></div>
              <div><dt>Animations</dt><dd>{selected.animations.length ? selected.animations.join(', ') : 'None declared'}</dd></div>
              <div><dt>Output</dt><dd>{selected.output.join(', ')}</dd></div>
            </dl>
          </section>

          <section>
            <h3>Example and limitations</h3>
            {selected.goldStandard ? (
              <p>The approved humanoid gold-standard reference defines the example silhouette, proportions, and surface language.</p>
            ) : (
              <p>No example asset is available for this model type yet.</p>
            )}
            <p>
              {selected.status === 'available'
                ? 'This local-first workflow currently supports the capabilities declared above.'
                : 'This registry entry is visible for planning, but it cannot initialize a build.'}
            </p>
          </section>
        </aside>
      </div>
    </main>
  )
}

export { ModelTypeCatalog }
