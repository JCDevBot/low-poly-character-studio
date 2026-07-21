import { humanoidChibiAnalysisAdapter, type HumanoidReferenceAnalysis, type ReferenceAnalysisAdapter } from './reference-analysis'

type SupportedAnalysisResult = HumanoidReferenceAnalysis

const adapters = new Map<string, ReferenceAnalysisAdapter<SupportedAnalysisResult>>([
  [humanoidChibiAnalysisAdapter.modelTypeId, humanoidChibiAnalysisAdapter],
])

function getReferenceAnalysisAdapter(modelTypeId: string) {
  const adapter = adapters.get(modelTypeId)
  if (!adapter) throw new Error(`No reference analysis adapter is registered for model type '${modelTypeId}'.`)
  return adapter
}

export { getReferenceAnalysisAdapter }
