import React, { useEffect, useState } from 'react'

type StageState = { status: 'pending' | 'running' | 'completed' | 'failed' }
export type BuildJob = {
  id: string
  createdAt: string
  modelTypeId: string
  stages: { animate: StageState }
}

export type AnimationClip = {
  name: string
  startFrame: number
  endFrame: number
  durationSeconds: number
  loop: boolean
  rootMotion: boolean
  targetJoints: string[]
}

type AnimationResponse = {
  ok: boolean
  metadata?: {
    schema: 'humanoid-animation-pack/v1'
    packId: string
    rigId: string
    fps: number
    jobId: string
  }
  clips?: AnimationClip[]
  error?: string
}

const API_BASE = 'http://localhost:3001'

export function selectLatestAnimatedJob(jobs: BuildJob[]) {
  return jobs
    .filter((job) => job.stages.animate.status === 'completed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

function AnimationClipCatalog() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [clips, setClips] = useState<AnimationClip[]>([])
  const [selectedClip, setSelectedClip] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [detail, setDetail] = useState('Looking for the latest completed animation stage…')

  async function loadLatestAnimations() {
    setStatus('loading')
    setDetail('Looking for the latest completed animation stage…')
    try {
      const jobsResponse = await fetch(`${API_BASE}/jobs`)
      if (!jobsResponse.ok) throw new Error(`Jobs request failed (${jobsResponse.status})`)
      const jobsPayload = await jobsResponse.json() as { ok: boolean; jobs: BuildJob[] }
      const latest = selectLatestAnimatedJob(jobsPayload.jobs ?? [])
      if (!latest) {
        setClips([])
        setJobId(null)
        setSelectedClip(null)
        setStatus('empty')
        setDetail('No completed animation artifact is available yet.')
        return
      }

      const animationResponse = await fetch(`${API_BASE}/jobs/${latest.id}/animations`)
      const animationPayload = await animationResponse.json() as AnimationResponse
      if (!animationResponse.ok || !animationPayload.ok || !animationPayload.clips) {
        throw new Error(animationPayload.error ?? `Animation request failed (${animationResponse.status})`)
      }

      setClips(animationPayload.clips)
      setJobId(latest.id)
      setSelectedClip((current) => current && animationPayload.clips?.some((clip) => clip.name === current)
        ? current
        : animationPayload.clips?.[0]?.name ?? null)
      setStatus('ready')
      setDetail(`${animationPayload.metadata?.packId ?? 'Animation pack'} · ${animationPayload.metadata?.fps ?? 24} fps`)
    } catch (error) {
      setClips([])
      setJobId(null)
      setSelectedClip(null)
      setStatus('error')
      setDetail(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => { void loadLatestAnimations() }, [])

  return (
    <section aria-labelledby="animation-clips-title" style={{ margin: '16px', padding: '16px', border: '1px solid #343b4a', borderRadius: 10, background: '#151922' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h2 id="animation-clips-title" style={{ margin: 0, fontSize: '1rem' }}>Animation clips</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: '0.85rem' }}>{detail}</p>
        </div>
        <button type="button" onClick={() => void loadLatestAnimations()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Loading…' : 'Refresh clips'}
        </button>
      </div>

      {status === 'ready' ? (
        <div>
          <div aria-label="Available animation clips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {clips.map((clip) => (
              <button
                type="button"
                key={clip.name}
                aria-pressed={selectedClip === clip.name}
                onClick={() => {
                  setSelectedClip(clip.name)
                  window.dispatchEvent(new CustomEvent('low-poly:animation-clip-selected', { detail: { jobId, clip: clip.name } }))
                }}
                style={{ borderColor: selectedClip === clip.name ? '#8fb9ff' : undefined }}
              >
                {clip.name}
              </button>
            ))}
          </div>
          {selectedClip ? (() => {
            const clip = clips.find((candidate) => candidate.name === selectedClip)
            return clip ? (
              <p style={{ margin: '12px 0 0', fontSize: '0.85rem' }}>
                <strong>{clip.name}</strong>: {clip.durationSeconds.toFixed(2)}s · frames {clip.startFrame}–{clip.endFrame} · {clip.loop ? 'looping' : 'one-shot'} · {clip.rootMotion ? 'root motion' : 'in place'}
              </p>
            ) : null
          })() : null}
        </div>
      ) : null}

      {status === 'empty' ? <p style={{ marginBottom: 0 }}>Run the animate stage for a build job, then refresh this panel.</p> : null}
      {status === 'error' ? <p style={{ marginBottom: 0 }}>Animation metadata is unavailable. Confirm the local API is running and a completed animate-stage artifact exists.</p> : null}
    </section>
  )
}

export { AnimationClipCatalog }
