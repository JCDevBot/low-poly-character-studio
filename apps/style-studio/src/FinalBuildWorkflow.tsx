import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  HUMANOID_LANDMARK_KEYS,
  buildHumanoidStyleDna,
  selectLatestFinalizedJob,
  type FinalizedJobSummary,
  type HumanoidLandmarkKey,
  type Point,
} from './final-build-workflow'
import './final-build-workflow.css'

const API_BASE = 'http://localhost:3001'
const PIPELINE_STAGES = ['model', 'rig', 'animate', 'validate', 'export'] as const

type PipelineStage = (typeof PIPELINE_STAGES)[number]
type StageState = {
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: { message: string; code?: string; details?: string }
}

type BuildJob = FinalizedJobSummary & {
  stages: Record<'ingest' | 'analyze' | PipelineStage, StageState>
}

type FinalGlbValidation = {
  schema: 'final-glb-validation/v1'
  valid: boolean
  sourceArtifact: string
  byteLength: number
  gltfVersion: string | null
  meshCount: number
  materialCount: number
  skinCount: number
  animationClips: string[]
  externalResources: string[]
  errors: string[]
}

type FinalArtifactMetadata = {
  schema: 'final-artifact/v1'
  jobId: string
  modelTypeId: string
  pipelineSchema: string
  artifact: string
  validationReport: string
  previewUrl: string
  downloadUrl: string
  animationClips: string[]
}

type FinalResponse = {
  ok: true
  job?: BuildJob
  metadata: FinalArtifactMetadata
  validation: FinalGlbValidation
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
      : init?.headers,
  })
  const text = await response.text()
  let payload: Record<string, unknown> = {}
  if (text) {
    try { payload = JSON.parse(text) as Record<string, unknown> }
    catch { payload = { error: text } }
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`)
  }
  return payload as T
}

function readReferenceSet() {
  const value = localStorage.getItem('low-poly-character-studio.reference-set.v1')
  if (!value) return null
  try { return JSON.parse(value) as unknown }
  catch { return null }
}

function readEditableStyleDna() {
  const image = document.querySelector<HTMLImageElement>('.imageLayer img')
  if (!image) throw new Error('The landmark editor is not ready. Load a front reference first.')

  const landmarks: Partial<Record<HumanoidLandmarkKey, Point>> = {}
  for (const key of HUMANOID_LANDMARK_KEYS) {
    const marker = document.querySelector<HTMLElement>(`.imageLayer [data-landmark="${key}"]`)
    if (!marker) continue
    const x = Number.parseFloat(marker.style.left)
    const y = Number.parseFloat(marker.style.top)
    if (Number.isFinite(x) && Number.isFinite(y)) landmarks[key] = { x, y }
  }

  return buildHumanoidStyleDna({
    source: image.currentSrc || image.src,
    imageSize: {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    },
    landmarks,
  })
}

function FinalGlbPreview(props: {
  modelUrl: string | null
  selectedClip: string | null
  onReady: (clips: string[]) => void
  onError: (message: string) => void
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map())
  const activeActionRef = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    mount.innerHTML = ''
    actionsRef.current.clear()
    activeActionRef.current = null
    mixerRef.current = null

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d0f15')
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.01, 100)
    camera.position.set(0, 0.65, 3.1)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x293047, 1.5))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(3, 4, 5)
    scene.add(key)
    const grid = new THREE.GridHelper(2.4, 12, 0x46506c, 0x24293a)
    grid.position.y = -0.82
    scene.add(grid)

    let frame = 0
    let disposed = false
    let loaded: THREE.Object3D | null = null
    const clock = new THREE.Clock()

    if (props.modelUrl) {
      new GLTFLoader().load(
        props.modelUrl,
        (gltf) => {
          if (disposed) return
          loaded = gltf.scene
          const box = new THREE.Box3().setFromObject(loaded)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDimension = Math.max(size.x, size.y, size.z) || 1
          const scale = 1.65 / maxDimension
          loaded.scale.setScalar(scale)
          loaded.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
          scene.add(loaded)

          const mixer = new THREE.AnimationMixer(loaded)
          mixerRef.current = mixer
          const actions = new Map<string, THREE.AnimationAction>()
          for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip))
          actionsRef.current = actions
          props.onReady([...actions.keys()])

          const requested = props.selectedClip ? actions.get(props.selectedClip) : undefined
          const first = actions.values().next().value as THREE.AnimationAction | undefined
          const action = requested ?? first
          if (action) {
            action.reset().play()
            activeActionRef.current = action
          }
        },
        undefined,
        (error) => props.onError(error instanceof Error ? error.message : 'The validated GLB could not be loaded.')
      )
    }

    function animate() {
      frame = requestAnimationFrame(animate)
      mixerRef.current?.update(clock.getDelta())
      renderer.render(scene, camera)
    }
    animate()

    const resize = () => {
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', resize)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      mixerRef.current?.stopAllAction()
      if (loaded) {
        loaded.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        })
      }
      renderer.dispose()
      mount.innerHTML = ''
    }
  }, [props.modelUrl])

  useEffect(() => {
    if (!props.selectedClip) return
    const next = actionsRef.current.get(props.selectedClip)
    if (!next || next === activeActionRef.current) return
    activeActionRef.current?.fadeOut(0.15)
    next.reset().fadeIn(0.15).play()
    activeActionRef.current = next
  }, [props.selectedClip])

  return <div ref={mountRef} className="finalGlbPreview" aria-label="Validated animated GLB preview" />
}

function FinalBuildWorkflow({ modelTypeId }: { modelTypeId: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [detail, setDetail] = useState('No validated build loaded.')
  const [job, setJob] = useState<BuildJob | null>(null)
  const [metadata, setMetadata] = useState<FinalArtifactMetadata | null>(null)
  const [validation, setValidation] = useState<FinalGlbValidation | null>(null)
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [selectedClip, setSelectedClip] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  function applyFinalResult(result: FinalResponse) {
    if (result.job) setJob(result.job)
    setMetadata(result.metadata)
    setValidation(result.validation)
    setSelectedClip(result.metadata.animationClips[0] ?? null)
    setModelUrl(`${API_BASE}${result.metadata.previewUrl}?job=${encodeURIComponent(result.metadata.jobId)}&t=${Date.now()}`)
    setPreviewError(null)
  }

  async function loadLatestFinalized(reportErrors = true) {
    try {
      const jobsResponse = await requestJson<{ ok: true; jobs: BuildJob[] }>('/jobs')
      const latest = selectLatestFinalizedJob(jobsResponse.jobs)
      if (!latest) {
        setDetail('No completed validated export exists yet.')
        return
      }
      const result = await requestJson<FinalResponse>(`/jobs/${latest.id}/final`)
      setJob(jobsResponse.jobs.find((candidate) => candidate.id === latest.id) ?? null)
      applyFinalResult(result)
      setStatus('success')
      setDetail(`Loaded validated job ${latest.id}.`)
    } catch (error) {
      if (!reportErrors) return
      setStatus('error')
      setDetail(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => { void loadLatestFinalized(false) }, [])

  async function runBuild() {
    setOpen(true)
    setStatus('running')
    setDetail('Preparing editable StyleDNA…')
    setMetadata(null)
    setValidation(null)
    setModelUrl(null)
    setPreviewError(null)

    try {
      if (modelTypeId !== 'humanoid/chibi-v1') throw new Error(`Final build is not available for ${modelTypeId}.`)
      const styleDna = readEditableStyleDna()
      const created = await requestJson<{ ok: true; job: BuildJob }>('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          modelTypeId,
          input: { styleDna, referenceSet: readReferenceSet() },
        }),
      })
      setJob(created.job)

      const stageRequests: Array<{ label: string; path: string }> = [
        { label: 'Generating model geometry…', path: `/jobs/${created.job.id}/stages/model/run` },
        { label: 'Rigging and skinning…', path: `/jobs/${created.job.id}/stages/rig/run` },
        { label: 'Adding animation clips…', path: `/jobs/${created.job.id}/stages/animate/run` },
      ]

      for (const stage of stageRequests) {
        setDetail(stage.label)
        const result = await requestJson<{ ok: true; job: BuildJob }>(stage.path, { method: 'POST' })
        setJob(result.job)
      }

      setDetail('Validating and exporting the final GLB…')
      const final = await requestJson<FinalResponse>(`/jobs/${created.job.id}/stages/finalize/run`, { method: 'POST' })
      applyFinalResult(final)
      setStatus('success')
      setDetail('Validated GLB ready for preview and download.')
    } catch (error) {
      setStatus('error')
      setDetail(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <>
      <button type="button" className="finalWorkflowLauncher" onClick={() => setOpen(true)}>
        Validated GLB
      </button>
      {open ? (
        <section className="finalWorkflowDrawer" aria-labelledby="final-workflow-title">
          <header>
            <div>
              <h2 id="final-workflow-title">Final rigged GLB</h2>
              <p>Run the persisted model, rig, animation, validation, and export stages.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close final build panel">Close</button>
          </header>

          <div className="finalWorkflowActions">
            <button type="button" className="primary" onClick={() => void runBuild()} disabled={status === 'running'}>
              {status === 'running' ? 'Building…' : 'Build validated humanoid'}
            </button>
            <button type="button" onClick={() => void loadLatestFinalized()} disabled={status === 'running'}>Load latest completed</button>
          </div>

          <p className={`finalWorkflowStatus ${status}`} role="status" aria-live="polite">{detail}</p>
          {job ? <p className="finalWorkflowJob">Job <code>{job.id}</code></p> : null}

          <ol className="finalStageList" aria-label="Build stage status">
            {PIPELINE_STAGES.map((stage) => {
              const state = job?.stages[stage]
              return (
                <li key={stage} data-status={state?.status ?? 'pending'}>
                  <span>{stage}</span>
                  <strong>{state?.status ?? 'pending'}</strong>
                  {state?.error ? <small>{state.error.details ?? state.error.message}</small> : null}
                </li>
              )
            })}
          </ol>

          {modelUrl ? (
            <div className="finalPreviewSection">
              <FinalGlbPreview
                modelUrl={modelUrl}
                selectedClip={selectedClip}
                onReady={(clips) => {
                  if (!selectedClip && clips[0]) setSelectedClip(clips[0])
                  setPreviewError(null)
                }}
                onError={setPreviewError}
              />
              {previewError ? <p className="finalWorkflowError" role="alert">Preview failed: {previewError}</p> : null}
              <div className="finalClipControls" aria-label="Final GLB animation clips">
                {metadata?.animationClips.map((clip) => (
                  <button
                    type="button"
                    key={clip}
                    aria-pressed={selectedClip === clip}
                    className={selectedClip === clip ? 'active' : ''}
                    onClick={() => setSelectedClip(clip)}
                  >
                    {clip}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {validation ? (
            <section className={validation.valid ? 'finalValidation valid' : 'finalValidation invalid'} aria-label="Final GLB validation result">
              <h3>{validation.valid ? 'Validation passed' : 'Validation failed'}</h3>
              <dl>
                <div><dt>glTF</dt><dd>{validation.gltfVersion ?? 'missing'}</dd></div>
                <div><dt>Meshes</dt><dd>{validation.meshCount}</dd></div>
                <div><dt>Materials</dt><dd>{validation.materialCount}</dd></div>
                <div><dt>Skins</dt><dd>{validation.skinCount}</dd></div>
                <div><dt>Clips</dt><dd>{validation.animationClips.length}</dd></div>
                <div><dt>Size</dt><dd>{Math.round(validation.byteLength / 1024)} KB</dd></div>
              </dl>
              {validation.errors.length ? <ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
            </section>
          ) : null}

          {metadata && validation?.valid ? (
            <a className="finalDownload" href={`${API_BASE}${metadata.downloadUrl}`} download>
              Download validated GLB
            </a>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

export { FinalBuildWorkflow }
