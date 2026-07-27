import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HUMANOID_LANDMARK_KEYS, buildHumanoidStyleDna, type HumanoidLandmarkKey, type Point } from './final-build-workflow'
import './final-build-workflow.css'

const API_BASE = 'http://localhost:3001'
const STAGES = ['model', 'rig', 'animate', 'validate', 'export'] as const

type Stage = (typeof STAGES)[number]
type Job = { id: string; stages: Record<Stage | 'ingest' | 'analyze', { status: string; error?: { message: string; details?: string } }> }
type FinalResult = {
  ok: true
  job: Job
  metadata: { jobId: string; previewUrl: string; downloadUrl: string; animationClips: string[] }
  validation: { valid: boolean; gltfVersion: string | null; meshCount: number; materialCount: number; skinCount: number; animationClips: string[]; errors: string[] }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
  })
  const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
  if (!response.ok || payload.ok === false) throw new Error(payload.error ?? `Request failed (${response.status})`)
  return payload as T
}

function readJson(key: string) {
  const value = localStorage.getItem(key)
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return null }
}

function readStyleDna() {
  const image = document.querySelector<HTMLImageElement>('.imageLayer img')
  if (!image) throw new Error('Load and analyze a front reference before building.')
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
    imageSize: { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height },
    landmarks,
  })
}

function Preview({ url, clip }: { url: string; clip: string | null }) {
  const mount = useRef<HTMLDivElement | null>(null)
  const actions = useRef(new Map<string, THREE.AnimationAction>())
  const active = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    if (!mount.current) return
    const host = mount.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d0f15')
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(host.clientHeight, 1), 0.01, 100)
    camera.position.set(0, 0.65, 3.1)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(host.clientWidth, host.clientHeight)
    host.appendChild(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x293047, 1.5))
    const light = new THREE.DirectionalLight(0xffffff, 2)
    light.position.set(3, 4, 5)
    scene.add(light)
    let mixer: THREE.AnimationMixer | null = null
    let model: THREE.Object3D | null = null
    let frame = 0
    const clock = new THREE.Clock()
    new GLTFLoader().load(url, (gltf) => {
      model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const scale = 1.65 / (Math.max(size.x, size.y, size.z) || 1)
      model.scale.setScalar(scale)
      model.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
      scene.add(model)
      mixer = new THREE.AnimationMixer(model)
      actions.current = new Map(gltf.animations.map((item) => [item.name, mixer!.clipAction(item)]))
      const first = actions.current.values().next().value as THREE.AnimationAction | undefined
      first?.play()
      active.current = first ?? null
    })
    const animate = () => {
      frame = requestAnimationFrame(animate)
      mixer?.update(clock.getDelta())
      renderer.render(scene, camera)
    }
    animate()
    return () => {
      cancelAnimationFrame(frame)
      mixer?.stopAllAction()
      renderer.dispose()
      host.innerHTML = ''
    }
  }, [url])

  useEffect(() => {
    if (!clip) return
    const next = actions.current.get(clip)
    if (!next || next === active.current) return
    active.current?.fadeOut(0.15)
    next.reset().fadeIn(0.15).play()
    active.current = next
  }, [clip])

  return <div ref={mount} className="finalGlbPreview" aria-label="Generated GLB preview" />
}

function VerticalSliceBuildWorkflow({ modelTypeId }: { modelTypeId: string }) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('Ready to run the complete persisted pipeline.')
  const [result, setResult] = useState<FinalResult | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [clip, setClip] = useState<string | null>(null)

  async function run() {
    setOpen(true)
    setRunning(true)
    setResult(null)
    try {
      if (modelTypeId !== 'humanoid/chibi-v1') throw new Error(`The complete pipeline is not available for ${modelTypeId}.`)
      setMessage('Creating a persisted job from the confirmed reference and editable StyleDNA…')
      const created = await requestJson<{ ok: true; job: Job }>('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          modelTypeId,
          input: {
            styleDna: readStyleDna(),
            referenceSet: readJson('low-poly-character-studio.reference-set.v1'),
            analysis: readJson('low-poly-character-studio.reference-analysis.v1'),
            modelTypeConfirmation: readJson('low-poly-character-studio.model-type-confirmation.v1'),
          },
        }),
      })
      setJob(created.job)
      setMessage('Running model, rig, animation, validation, and export stages…')
      const completed = await requestJson<FinalResult>(`/jobs/${created.job.id}/run`, { method: 'POST' })
      setJob(completed.job)
      setResult(completed)
      setClip(completed.metadata.animationClips[0] ?? null)
      setMessage('Complete validated vertical slice ready for preview and download.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
    }
  }

  return <>
    <button type="button" className="finalWorkflowLauncher" onClick={() => setOpen(true)}>Validated GLB</button>
    {open ? <section className="finalWorkflowDrawer" aria-labelledby="vertical-build-title">
      <header><div><h2 id="vertical-build-title">Gold-standard vertical slice</h2><p>One persisted run from confirmed reference to validated animated GLB.</p></div><button type="button" onClick={() => setOpen(false)}>Close</button></header>
      <div className="finalWorkflowActions"><button type="button" className="primary" disabled={running} onClick={() => void run()}>{running ? 'Building…' : 'Run complete pipeline'}</button></div>
      <p className={`finalWorkflowStatus ${result ? 'success' : running ? 'running' : 'idle'}`} role="status" aria-live="polite">{message}</p>
      {job ? <p className="finalWorkflowJob">Job <code>{job.id}</code></p> : null}
      <ol className="finalStageList" aria-label="Build stage status">{STAGES.map((stage) => <li key={stage} data-status={job?.stages[stage]?.status ?? 'pending'}><span>{stage}</span><strong>{job?.stages[stage]?.status ?? 'pending'}</strong>{job?.stages[stage]?.error ? <small>{job.stages[stage].error?.details ?? job.stages[stage].error?.message}</small> : null}</li>)}</ol>
      {result ? <>
        <Preview url={`${API_BASE}${result.metadata.previewUrl}?t=${Date.now()}`} clip={clip} />
        <div className="finalClipControls">{result.metadata.animationClips.map((name) => <button type="button" key={name} className={clip === name ? 'active' : ''} aria-pressed={clip === name} onClick={() => setClip(name)}>{name}</button>)}</div>
        <section className={result.validation.valid ? 'finalValidation valid' : 'finalValidation invalid'}><h3>{result.validation.valid ? 'Validation passed' : 'Validation failed'}</h3><p>{result.validation.meshCount} meshes · {result.validation.materialCount} materials · {result.validation.skinCount} skins · {result.validation.animationClips.length} clips</p>{result.validation.errors.length ? <ul>{result.validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}</section>
        {result.validation.valid ? <a className="finalDownload" href={`${API_BASE}${result.metadata.downloadUrl}`} download>Download validated GLB</a> : null}
      </> : null}
    </section> : null}
  </>
}

export { VerticalSliceBuildWorkflow }
