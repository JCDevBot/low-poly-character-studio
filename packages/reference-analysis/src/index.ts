import {
  type ClassificationArtifact,
  type Evidence,
  type ExpectedPartObservationsArtifact,
  type ReferenceSetArtifact,
  type SemanticPartGraphArtifact,
  type StyleDnaArtifact,
  type ViewAnalysisArtifact,
} from "../../pipeline-contracts/src/artifacts";
import { modelTypeRegistry } from "../../model-types/src/registry";

export interface AnalysisContext {
  jobId: string;
  createdAt: string;
  producerVersion?: string;
}

export interface AnalysisArtifacts {
  classification: ClassificationArtifact;
  viewAnalysis: ViewAnalysisArtifact;
  expectedParts: ExpectedPartObservationsArtifact;
  partGraph: SemanticPartGraphArtifact;
  styleDna: StyleDnaArtifact;
}

export interface ReferenceAnalysisProvider {
  readonly id: string;
  readonly version: string;
  analyze(referenceSet: ReferenceSetArtifact, context: AnalysisContext): AnalysisArtifacts;
}

export interface ModelTypeDecision {
  modelTypeId: string;
  state: "confirmed" | "overridden";
  note?: string;
}

function artifactId(jobId: string, suffix: string): string {
  return `${jobId}:${suffix}:v1`;
}

function evidence<T>(
  value: T | null,
  origin: Evidence<T>["origin"],
  confidence: number | null,
  confirmed = false,
  sourceArtifactIds?: readonly string[],
  note?: string,
): Evidence<T> {
  return { value, origin, confidence, confirmed, sourceArtifactIds, note };
}

function chooseRecommendation(referenceSet: ReferenceSetArtifact): { modelTypeId: string; confidence: number; note: string } {
  if (referenceSet.modelTypeHint && modelTypeRegistry.get(referenceSet.modelTypeHint)) {
    return {
      modelTypeId: referenceSet.modelTypeHint,
      confidence: 0.96,
      note: "Recommendation uses the supplied model-type hint and registry compatibility.",
    };
  }

  const hasFront = referenceSet.references.some((reference) => reference.slot === "front");
  if (hasFront) {
    return {
      modelTypeId: "humanoid/chibi-v1",
      confidence: 0.72,
      note: "Local fallback recommends the only available front-reference model type; user confirmation is required.",
    };
  }

  return {
    modelTypeId: "humanoid/chibi-v1",
    confidence: 0.45,
    note: "No recognized front slot was supplied. Recommendation is low confidence and must be reviewed.",
  };
}

function applyDecision(
  recommendation: { modelTypeId: string; confidence: number; note: string },
  decision: ModelTypeDecision | undefined,
  referenceSetId: string,
): { selected: Evidence<string>; confirmationState: ClassificationArtifact["confirmationState"] } {
  if (!decision) {
    return {
      selected: evidence(
        recommendation.modelTypeId,
        "inferred",
        recommendation.confidence,
        false,
        [referenceSetId],
        recommendation.note,
      ),
      confirmationState: "pending",
    };
  }

  if (!modelTypeRegistry.get(decision.modelTypeId)) {
    throw new Error(`Unknown model type override '${decision.modelTypeId}'.`);
  }

  const overridden = decision.modelTypeId !== recommendation.modelTypeId || decision.state === "overridden";
  return {
    selected: evidence(
      decision.modelTypeId,
      overridden ? "user-overridden" : "user-confirmed",
      overridden ? null : recommendation.confidence,
      true,
      [referenceSetId],
      decision.note,
    ),
    confirmationState: overridden ? "overridden" : "confirmed",
  };
}

export class DeterministicReferenceAnalysisProvider implements ReferenceAnalysisProvider {
  readonly id = "deterministic-reference-analysis-v1";
  readonly version = "1.0.0";

  constructor(private readonly decision?: ModelTypeDecision) {}

  analyze(referenceSet: ReferenceSetArtifact, context: AnalysisContext): AnalysisArtifacts {
    if (referenceSet.references.length === 0) throw new Error("Reference set must contain at least one reference.");

    const recommendation = chooseRecommendation(referenceSet);
    const { selected, confirmationState } = applyDecision(recommendation, this.decision, referenceSet.artifactId);
    const modelTypeId = selected.value;
    if (!modelTypeId) throw new Error("A model type must be selected before semantic analysis.");
    const manifest = modelTypeRegistry.require(modelTypeId);
    const front = referenceSet.references.find((reference) => reference.slot === "front") ?? referenceSet.references[0];
    const producer = { id: this.id, version: context.producerVersion ?? this.version };
    const header = { schemaVersion: "1.0.0" as const, jobId: context.jobId, createdAt: context.createdAt, producer };

    const classification: ClassificationArtifact = {
      ...header,
      kind: "classification",
      artifactId: artifactId(context.jobId, "classification"),
      recommendation: selected,
      alternatives: modelTypeRegistry
        .list()
        .filter((candidate) => candidate.id !== recommendation.modelTypeId)
        .map((candidate) => ({ modelTypeId: candidate.id, confidence: candidate.status === "planned" ? 0.05 : 0.2 })),
      confirmationState,
    };

    const frontRole = front.slot === "front";
    const viewAnalysis: ViewAnalysisArtifact = {
      ...header,
      kind: "view-analysis",
      artifactId: artifactId(context.jobId, "view-analysis"),
      referenceId: front.id,
      role: evidence(frontRole ? "front" : "unknown", frontRole ? "measured" : "inferred", frontRole ? 1 : 0.4, frontRole, [referenceSet.artifactId]),
      yawDegrees: evidence(frontRole ? 0 : null, frontRole ? "defaulted" : "unavailable", frontRole ? 0.7 : null, false, [front.id]),
      pitchDegrees: evidence(frontRole ? 0 : null, frontRole ? "defaulted" : "unavailable", frontRole ? 0.6 : null, false, [front.id]),
      pose: evidence("neutral-standing", "inferred", 0.65, false, [front.id]),
      visibleSide: evidence("both", "inferred", 0.7, false, [front.id]),
      groundLine: evidence(front.height ? front.height - 1 : null, front.height ? "defaulted" : "unavailable", front.height ? 0.55 : null, false, [front.id]),
      occlusions: [],
    };

    const expectedParts: ExpectedPartObservationsArtifact = {
      ...header,
      kind: "expected-part-observations",
      artifactId: artifactId(context.jobId, "expected-parts"),
      modelTypeId,
      observations: (manifest.expectedParts ?? []).map((part) => ({
        partId: part.id,
        state: frontRole ? (part.required ? "observed" : "inferred") : "unknown",
        evidence: evidence(
          frontRole ? `${part.label} expected in front reference` : null,
          frontRole ? (part.required ? "inferred" : "defaulted") : "unavailable",
          frontRole ? (part.required ? 0.7 : 0.45) : null,
          false,
          [viewAnalysis.artifactId],
        ),
      })),
    };

    const observationByPart = new Map(expectedParts.observations.map((observation) => [observation.partId, observation]));
    const partGraph: SemanticPartGraphArtifact = {
      ...header,
      kind: "semantic-part-graph",
      artifactId: artifactId(context.jobId, "part-graph"),
      modelTypeId,
      nodes: (manifest.expectedParts ?? []).map((part) => ({
        id: `${context.jobId}:part:${part.id}`,
        expectedPartId: part.id,
        label: part.label,
        parentId: part.parentId ? `${context.jobId}:part:${part.parentId}` : null,
        attachmentRole: part.attachmentRole,
        deformationRole: part.deformationRole,
        state: observationByPart.get(part.id)?.state ?? "unknown",
      })),
    };

    const styleDna: StyleDnaArtifact = {
      ...header,
      kind: "style-dna",
      artifactId: artifactId(context.jobId, "style-dna"),
      modelTypeId,
      modelTypeVersion: manifest.version,
      values: {
        sourceViewRole: evidence(viewAnalysis.role.value, viewAnalysis.role.origin, viewAnalysis.role.confidence, viewAnalysis.role.confirmed, [viewAnalysis.artifactId]),
        headsTall: evidence(manifest.goldStandard?.headsTall.target ?? 2.7, "defaulted", 0.5, false, [classification.artifactId]),
        expectedPartCount: evidence(partGraph.nodes.length, "measured", 1, true, [partGraph.artifactId]),
      },
    };

    return { classification, viewAnalysis, expectedParts, partGraph, styleDna };
  }
}

export function analyzeReferenceSet(
  referenceSet: ReferenceSetArtifact,
  context: AnalysisContext,
  provider: ReferenceAnalysisProvider = new DeterministicReferenceAnalysisProvider(),
): AnalysisArtifacts {
  return provider.analyze(referenceSet, context);
}
