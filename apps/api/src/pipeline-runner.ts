import type { BuildJobManifest } from './build-jobs.js'
import { BuildJobStore } from './build-jobs.js'

type StageRunner = (jobId: string) => Promise<unknown>

type PipelineRunnerOptions = {
  jobId: string
  jobs: BuildJobStore
  runModel: StageRunner
  runRig: StageRunner
  runAnimation: StageRunner
  finalize: StageRunner
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function validateReadyInput(job: BuildJobManifest) {
  const input = asObject(job.input)
  const referenceSet = asObject(input?.referenceSet ?? input)
  const references = asObject(referenceSet?.references)
  const analysis = asObject(referenceSet?.analysis ?? input?.analysis)
  const confirmation = asObject(referenceSet?.modelTypeConfirmation ?? input?.modelTypeConfirmation)

  if (!references?.front) throw new Error('A persisted front reference is required before running the pipeline')
  if (analysis?.schemaVersion !== 'humanoid-reference-analysis/v1' || analysis.modelTypeId !== job.modelTypeId) {
    throw new Error('Persisted humanoid reference analysis is required before running the pipeline')
  }
  if (confirmation?.schemaVersion !== 'model-type-confirmation/v1' || confirmation.modelTypeId !== job.modelTypeId) {
    throw new Error(`Explicit confirmation of ${job.modelTypeId} is required before running the pipeline`)
  }
}

async function completePersistedInputStages(job: BuildJobManifest, jobs: BuildJobStore) {
  if (job.stages.ingest.status !== 'completed') {
    await jobs.startStage(job.id, 'ingest')
    job = await jobs.completeStage(job.id, 'ingest', { artifacts: ['input/reference-set'] })
  }
  if (job.stages.analyze.status !== 'completed') {
    await jobs.startStage(job.id, 'analyze')
    job = await jobs.completeStage(job.id, 'analyze', {
      artifacts: ['input/reference-analysis', 'input/model-type-confirmation']
    })
  }
  return job
}

export async function runCompleteHumanoidPipeline(options: PipelineRunnerOptions) {
  let job = await options.jobs.get(options.jobId)
  if (!job) throw new Error(`Build job not found: ${options.jobId}`)
  if (job.modelTypeId !== 'humanoid/chibi-v1') throw new Error(`Complete pipeline does not support ${job.modelTypeId}`)

  validateReadyInput(job)
  job = await completePersistedInputStages(job, options.jobs)

  if (job.stages.model.status !== 'completed') {
    await options.runModel(job.id)
    job = (await options.jobs.get(job.id))!
  }
  if (job.stages.rig.status !== 'completed') {
    await options.runRig(job.id)
    job = (await options.jobs.get(job.id))!
  }
  if (job.stages.animate.status !== 'completed') {
    await options.runAnimation(job.id)
    job = (await options.jobs.get(job.id))!
  }
  if (job.stages.validate.status !== 'completed' || job.stages.export.status !== 'completed') {
    await options.finalize(job.id)
    job = (await options.jobs.get(job.id))!
  }

  return job
}
