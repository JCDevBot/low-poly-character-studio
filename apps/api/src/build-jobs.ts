import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const PIPELINE_STAGES = [
  'ingest',
  'analyze',
  'model',
  'rig',
  'animate',
  'validate',
  'export'
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface StageError {
  message: string
  code?: string
  details?: string
}

export interface StageState {
  status: StageStatus
  startedAt?: string
  completedAt?: string
  failedAt?: string
  error?: StageError
  artifacts: string[]
}

export interface BuildJobManifest {
  schema: 'build-job/v1'
  id: string
  modelTypeId: string
  createdAt: string
  updatedAt: string
  input: unknown
  stages: Record<PipelineStage, StageState>
}

export interface CreateBuildJobInput {
  modelTypeId: string
  input?: unknown
}

export interface CompleteStageInput {
  artifacts?: string[]
}

export interface FailStageInput {
  message: string
  code?: string
  details?: string
}

function createStageState(): StageState {
  return { status: 'pending', artifacts: [] }
}

function createStages(): Record<PipelineStage, StageState> {
  return Object.fromEntries(PIPELINE_STAGES.map(stage => [stage, createStageState()])) as Record<PipelineStage, StageState>
}

function isPipelineStage(value: string): value is PipelineStage {
  return PIPELINE_STAGES.includes(value as PipelineStage)
}

export class BuildJobStore {
  constructor(private readonly workspaceDir: string) {}

  private jobDir(id: string) {
    return path.join(this.workspaceDir, id)
  }

  private manifestPath(id: string) {
    return path.join(this.jobDir(id), 'manifest.json')
  }

  async initialize() {
    await mkdir(this.workspaceDir, { recursive: true })
  }

  async create(input: CreateBuildJobInput): Promise<BuildJobManifest> {
    if (input.modelTypeId !== 'humanoid/chibi-v1') {
      throw new Error(`Unsupported model type: ${input.modelTypeId}`)
    }

    await this.initialize()
    const now = new Date().toISOString()
    const job: BuildJobManifest = {
      schema: 'build-job/v1',
      id: randomUUID(),
      modelTypeId: input.modelTypeId,
      createdAt: now,
      updatedAt: now,
      input: input.input ?? null,
      stages: createStages()
    }
    await mkdir(path.join(this.jobDir(job.id), 'artifacts'), { recursive: true })
    await this.save(job)
    return job
  }

  async get(id: string): Promise<BuildJobManifest | null> {
    try {
      return JSON.parse(await readFile(this.manifestPath(id), 'utf8')) as BuildJobManifest
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async list(): Promise<BuildJobManifest[]> {
    await this.initialize()
    const entries = await readdir(this.workspaceDir, { withFileTypes: true })
    const jobs = await Promise.all(entries.filter(entry => entry.isDirectory()).map(entry => this.get(entry.name)))
    return jobs.filter((job): job is BuildJobManifest => job !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async startStage(id: string, stageName: string): Promise<BuildJobManifest> {
    const stage = this.requireStage(stageName)
    const job = await this.requireJob(id)
    const current = job.stages[stage]
    if (current.status === 'running') throw new Error(`Stage ${stage} is already running`)
    if (current.status === 'completed') throw new Error(`Stage ${stage} is already completed`)

    job.stages[stage] = {
      status: 'running',
      startedAt: new Date().toISOString(),
      artifacts: [...current.artifacts]
    }
    return this.save(job)
  }

  async completeStage(id: string, stageName: string, input: CompleteStageInput = {}): Promise<BuildJobManifest> {
    const stage = this.requireStage(stageName)
    const job = await this.requireJob(id)
    const current = job.stages[stage]
    if (current.status !== 'running') throw new Error(`Stage ${stage} must be running before completion`)

    job.stages[stage] = {
      status: 'completed',
      startedAt: current.startedAt,
      completedAt: new Date().toISOString(),
      artifacts: [...new Set([...current.artifacts, ...(input.artifacts ?? [])])]
    }
    return this.save(job)
  }

  async failStage(id: string, stageName: string, input: FailStageInput): Promise<BuildJobManifest> {
    const stage = this.requireStage(stageName)
    const job = await this.requireJob(id)
    const current = job.stages[stage]
    if (current.status !== 'running') throw new Error(`Stage ${stage} must be running before failure`)

    job.stages[stage] = {
      status: 'failed',
      startedAt: current.startedAt,
      failedAt: new Date().toISOString(),
      error: { message: input.message, code: input.code, details: input.details },
      artifacts: [...current.artifacts]
    }
    return this.save(job)
  }

  async listArtifacts(id: string): Promise<string[]> {
    const job = await this.requireJob(id)
    return [...new Set(PIPELINE_STAGES.flatMap(stage => job.stages[stage].artifacts))]
  }

  private requireStage(stageName: string): PipelineStage {
    if (!isPipelineStage(stageName)) throw new Error(`Unknown pipeline stage: ${stageName}`)
    return stageName
  }

  private async requireJob(id: string): Promise<BuildJobManifest> {
    const job = await this.get(id)
    if (!job) throw new Error(`Build job not found: ${id}`)
    return job
  }

  private async save(job: BuildJobManifest): Promise<BuildJobManifest> {
    job.updatedAt = new Date().toISOString()
    const target = this.manifestPath(job.id)
    const temporary = `${target}.tmp`
    await mkdir(this.jobDir(job.id), { recursive: true })
    await writeFile(temporary, `${JSON.stringify(job, null, 2)}\n`, 'utf8')
    await rename(temporary, target)
    return job
  }
}
