import express from 'express'
import cors from 'cors'
import { spawn } from 'node:child_process'
import path from 'node:path'

const app = express()
app.use(cors())
app.use(express.json())

const projectRoot = path.resolve(process.cwd(), '../..')
const generatedDir = path.join(projectRoot, 'packages/asset-compiler/dist/glb')

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

app.get('/health', (_req, res) => res.json({ ok: true }))

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

    res.json({
      ok: true,
      target,
      output: `/generated/${selected.output}`,
      builtAt: Date.now()
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
})

app.listen(3001, () => {
  console.log('API listening on http://localhost:3001')
  console.log(`Serving generated GLBs from ${generatedDir}`)
})
