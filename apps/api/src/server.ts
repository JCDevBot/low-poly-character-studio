import express from 'express'
import cors from 'cors'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { BuildJobStore } from './build-jobs.js'
import { runHumanoidModelStage } from './model-runner.js'
import { runHumanoidRigStage } from './rig-runner.js'
import { readAnimationMetadata, runHumanoidAnimationStage } from './animation-runner.js'
import { finalizeHumanoidGlb, readFinalArtifact, readFinalValidation } from './final-artifact.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))

const projectRoot = path.resolve(process.cwd(), '../..')
const generatedDir = path.join(projectRoot, 'packages/asset-compiler/dist/glb')
const buildWorkspace = process.env.BUILD_WORKSPACE ?? path.join(projectRoot, '.workspace/build-jobs')
const jobs = new BuildJobStore(buildWorkspace)

app.use('/generated', express.static(generatedDir))

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

function sendError(res: express.Response, error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : String(error)
  res.status(status).json({ ok: false, error: message })
}

app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/jobs', async (_req, res) => {
  try { res.json({ ok: true, jobs: await jobs.list() }) }
  catch (error) { sendError(res, error, 500) }
})

app.post('/jobs', async (req, res) => {
  try {
    const job = await jobs.create({ modelTypeId: req.body?.modelTypeId, input: req.body?.input })
    res.status(201).json({ ok: true, job })
  } catch (error) { sendError(res, error) }
})

app.get('/jobs/:id', async (req, res) => {
  try {
    const job = await jobs.get(req.params.id)
    if (!job) {
      res.status(404).json({ ok: false, error: `Build job not found: ${req.params.id}` })
      return
    }
    res.json({ ok: true, job })
  } catch (error) { sendError(res, error, 500) }
})

app.get('/jobs/:id/artifacts', async (req, res) => {
  try { res.json({ ok: true, artifacts: await jobs.listArtifacts(req.params.id) }) }
  catch (error) { sendError(res, error, 404) }
})

app.get('/jobs/:id/animations', async (req, res) => {
  try {
    const metadata = await readAnimationMetadata({ jobId: req.params.id, jobs, buildWorkspace })
    res.json({ ok: true, metadata, clips: metadata.clips })
  } catch (error) { sendError(res, error, 404) }
})

app.post('/jobs/:id/stages/model/run', async (req, res) => {
  try {
    const job = await runHumanoidModelStage({ jobId: req.params.id, jobs, buildWorkspace, projectRoot })
    res.json({ ok: true, job })
  } catch (error) { sendError(res, error, 500) }
})

app.post('/jobs/:id/stages/rig/run', async (req, res) => {
  try {
    const job = await runHumanoidRigStage({ jobId: req.params.id, jobs, buildWorkspace, projectRoot })
    res.json({ ok: true, job })
  } catch (error) { sendError(res, error, 500) }
})

app.post('/jobs/:id/stages/animate/run', async (req, res) => {
  try {
    const job = await runHumanoidAnimationStage({ jobId: req.params.id, jobs, buildWorkspace, projectRoot })
    res.json({ ok: true, job })
  } catch (error) { sendError(res, error, 500) }
})

app.post('/jobs/:id/stages/finalize/run', async (req, res) => {
  try {
    const result = await finalizeHumanoidGlb({ jobId: req.params.id, jobs, buildWorkspace })
    res.json({ ok: true, ...result })
  } catch (error) { sendError(res, error, 422) }
})

app.get('/jobs/:id/final', async (req, res) => {
  try {
    const options = { jobId: req.params.id, jobs, buildWorkspace }
    const [metadata, validation] = await Promise.all([
      readFinalArtifact(options),
      readFinalValidation(options)
    ])
    res.json({ ok: true, metadata, validation })
  } catch (error) { sendError(res, error, 404) }
})

app.get('/jobs/:id/final.glb', async (req, res) => {
  try {
    const metadata = await readFinalArtifact({ jobId: req.params.id, jobs, buildWorkspace })
    res.type('model/gltf-binary').sendFile(path.join(buildWorkspace, req.params.id, metadata.artifact))
  } catch (error) { sendError(res, error, 404) }
})

app.get('/jobs/:id/download', async (req, res) => {
  try {
    const metadata = await readFinalArtifact({ jobId: req.params.id, jobs, buildWorkspace })
    res.download(path.join(buildWorkspace, req.params.id, metadata.artifact), `humanoid-${req.params.id}.glb`)
  } catch (error) { sendError(res, error, 404) }
})

app.post('/jobs/:id/stages/:stage/start', async (req, res) => {
  try { res.json({ ok: true, job: await jobs.startStage(req.params.id, req.params.stage) }) }
  catch (error) { sendError(res, error) }
})

app.post('/jobs/:id/stages/:stage/complete', async (req, res) => {
  try {
    res.json({
      ok: true,
      job: await jobs.completeStage(req.params.id, req.params.stage, {
        artifacts: Array.isArray(req.body?.artifacts) ? req.body.artifacts : []
      })
    })
  } catch (error) { sendError(res, error) }
})

app.post('/jobs/:id/stages/:stage/fail', async (req, res) => {
  try {
    res.json({
      ok: true,
      job: await jobs.failStage(req.params.id, req.params.stage, {
        message: req.body?.message ?? 'Stage failed',
        code: req.body?.code,
        details: req.body?.details
      })
    })
  } catch (error) { sendError(res, error) }
})

app.post('/build/:target', async (req, res) => {
  try {
    const target = req.params.target
    const scripts: Record<string, { script: string; output: string }> = {
      head: {
        script: 'packages/asset-compiler/blender/scripts/library-builders/build_head_v001.py',
        output: 'head_v001.glb'
      },
      human: {
        script: 'packages/asset-compiler/blender/scripts/build_base_human.py',
        output: 'base_human_v003_style_dna.glb'
      }
    }
    if (!scripts[target]) {
      res.status(400).json({ ok: false, error: `Unknown build target: ${target}` })
      return
    }
    const selected = scripts[target]
    await run('blender', ['-b', '--python', path.join(projectRoot, selected.script)], projectRoot)
    res.json({ ok: true, target, output: `/generated/${selected.output}`, builtAt: Date.now() })
  } catch (error) { sendError(res, error, 500) }
})

await jobs.initialize()
app.listen(3001, () => {
  console.log('API listening on http://localhost:3001')
  console.log(`Serving generated GLBs from ${generatedDir}`)
  console.log(`Persisting build jobs in ${buildWorkspace}`)
})
