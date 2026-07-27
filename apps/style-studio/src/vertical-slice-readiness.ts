type ModelTypeConfirmation = {
  schemaVersion: 'model-type-confirmation/v1'
  modelTypeId: string
  confirmedAt: string
  source: 'user'
}

type ReferenceAnalysis = {
  schemaVersion?: string
  modelTypeId?: string
  adapterId?: string
  confidence?: { overall?: number; level?: string }
  colorRegions?: Array<{ name: string; rgb: [number, number, number]; sampleCount: number }>
  warnings?: Array<{ code: string; message: string }>
}

type ReferenceSet = {
  schemaVersion?: string
  modelTypeId?: string
  references?: Record<string, unknown>
  analysis?: ReferenceAnalysis
  modelTypeConfirmation?: ModelTypeConfirmation
}

type VerticalSliceReadiness = {
  hasFrontReference: boolean
  hasAnalysis: boolean
  modelTypeConfirmed: boolean
  ready: boolean
  reasons: string[]
}

const CONFIRMATION_STORAGE_KEY = 'low-poly-character-studio.model-type-confirmation.v1'
const REFERENCE_SET_STORAGE_KEY = 'low-poly-character-studio.reference-set.v1'
const ANALYSIS_STORAGE_KEY = 'low-poly-character-studio.reference-analysis.v1'

function parseStored<T>(value: string | null): T | null {
  if (!value) return null
  try { return JSON.parse(value) as T }
  catch { return null }
}

function createModelTypeConfirmation(modelTypeId: string, confirmedAt = new Date().toISOString()): ModelTypeConfirmation {
  return {
    schemaVersion: 'model-type-confirmation/v1',
    modelTypeId,
    confirmedAt,
    source: 'user',
  }
}

function deriveVerticalSliceReadiness(
  modelTypeId: string,
  referenceSet: ReferenceSet | null,
  analysis: ReferenceAnalysis | null,
  confirmation: ModelTypeConfirmation | null,
): VerticalSliceReadiness {
  const hasFrontReference = Boolean(referenceSet?.references?.front)
  const hasAnalysis = Boolean(
    analysis
    && analysis.schemaVersion === 'humanoid-reference-analysis/v1'
    && analysis.modelTypeId === modelTypeId,
  )
  const modelTypeConfirmed = Boolean(
    confirmation
    && confirmation.schemaVersion === 'model-type-confirmation/v1'
    && confirmation.modelTypeId === modelTypeId,
  )
  const reasons: string[] = []
  if (!hasFrontReference) reasons.push('Add a front reference image.')
  if (!hasAnalysis) reasons.push('Analyze the front reference.')
  if (!modelTypeConfirmed) reasons.push(`Confirm ${modelTypeId} before generation.`)
  return { hasFrontReference, hasAnalysis, modelTypeConfirmed, ready: reasons.length === 0, reasons }
}

function enrichReferenceSet(
  referenceSet: ReferenceSet,
  analysis: ReferenceAnalysis,
  confirmation: ModelTypeConfirmation,
): ReferenceSet {
  return { ...referenceSet, analysis, modelTypeConfirmation: confirmation }
}

export {
  ANALYSIS_STORAGE_KEY,
  CONFIRMATION_STORAGE_KEY,
  REFERENCE_SET_STORAGE_KEY,
  createModelTypeConfirmation,
  deriveVerticalSliceReadiness,
  enrichReferenceSet,
  parseStored,
}
export type { ModelTypeConfirmation, ReferenceAnalysis, ReferenceSet, VerticalSliceReadiness }
