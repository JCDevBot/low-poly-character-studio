export type ArtifactKind =
  | "reference-set"
  | "classification"
  | "view-analysis"
  | "expected-part-observations"
  | "semantic-part-graph"
  | "style-dna"
  | "model-plan"
  | "rig-plan"
  | "animation-plan"
  | "build-manifest"
  | "validation-report";

export type EvidenceOrigin =
  | "measured"
  | "inferred"
  | "mirrored"
  | "defaulted"
  | "user-confirmed"
  | "user-overridden"
  | "unavailable";

export interface ArtifactHeader<K extends ArtifactKind = ArtifactKind> {
  kind: K;
  schemaVersion: "1.0.0";
  artifactId: string;
  jobId: string;
  createdAt: string;
  producer: { id: string; version: string };
}

export interface Evidence<T> {
  value: T | null;
  origin: EvidenceOrigin;
  confidence: number | null;
  confirmed: boolean;
  sourceArtifactIds?: readonly string[];
  note?: string;
}

export interface ReferenceRecord {
  id: string;
  slot: string;
  uri: string;
  sha256: string;
  mediaType: string;
  width?: number;
  height?: number;
}

export interface ReferenceSetArtifact extends ArtifactHeader<"reference-set"> {
  modelTypeHint?: string;
  references: readonly ReferenceRecord[];
}

export interface ClassificationArtifact extends ArtifactHeader<"classification"> {
  recommendation: Evidence<string>;
  alternatives: readonly { modelTypeId: string; confidence: number }[];
  confirmationState: "pending" | "confirmed" | "overridden";
}

export interface ViewAnalysisArtifact extends ArtifactHeader<"view-analysis"> {
  referenceId: string;
  role: Evidence<"front" | "side" | "back" | "detail" | "unknown">;
  yawDegrees: Evidence<number>;
  pitchDegrees: Evidence<number>;
  pose: Evidence<string>;
  visibleSide: Evidence<"left" | "right" | "both" | "unknown">;
  groundLine: Evidence<number>;
  occlusions: readonly Evidence<string>[];
}

export type PartObservationState =
  | "observed"
  | "inferred"
  | "occluded"
  | "absent"
  | "unknown"
  | "unsupported";

export interface ExpectedPartObservation {
  partId: string;
  state: PartObservationState;
  evidence: Evidence<string>;
}

export interface ExpectedPartObservationsArtifact
  extends ArtifactHeader<"expected-part-observations"> {
  modelTypeId: string;
  observations: readonly ExpectedPartObservation[];
}

export interface SemanticPartNode {
  id: string;
  expectedPartId: string;
  label: string;
  parentId: string | null;
  attachmentRole: "root" | "attached" | "surface";
  deformationRole: "rigid" | "skinned" | "presentation";
  state: PartObservationState;
}

export interface SemanticPartGraphArtifact extends ArtifactHeader<"semantic-part-graph"> {
  modelTypeId: string;
  nodes: readonly SemanticPartNode[];
}

export interface StyleDnaArtifact extends ArtifactHeader<"style-dna"> {
  modelTypeId: string;
  modelTypeVersion: string;
  values: Readonly<Record<string, Evidence<unknown>>>;
}

export interface ModelPlanArtifact extends ArtifactHeader<"model-plan"> {
  modelTypeId: string;
  implementationId: string;
  styleDnaArtifactId: string;
  expectedParts: readonly string[];
  generationSettings: Readonly<Record<string, unknown>>;
}

export interface RigPlanArtifact extends ArtifactHeader<"rig-plan"> {
  rigId: string;
  implementationId: string;
  modelPlanArtifactId: string;
  requiredJoints: readonly string[];
}

export interface AnimationPlanArtifact extends ArtifactHeader<"animation-plan"> {
  packId: string;
  implementationId: string;
  rigPlanArtifactId: string;
  requestedClips: readonly string[];
  frameRate: number;
  rootMotion: "in-place" | "authored";
}

export type PipelineStage =
  | "ingest"
  | "classify"
  | "analyze-view"
  | "observe-parts"
  | "build-part-graph"
  | "derive-style-dna"
  | "plan-model"
  | "plan-rig"
  | "plan-animation"
  | "model"
  | "rig"
  | "animate"
  | "validate"
  | "export";

export interface StageRecord {
  stage: PipelineStage;
  status: "pending" | "running" | "completed" | "failed" | "invalidated";
  inputArtifactIds: readonly string[];
  outputArtifactIds: readonly string[];
  error?: { code: string; message: string };
}

export interface BuildManifestArtifact extends ArtifactHeader<"build-manifest"> {
  pipelineVersion: string;
  modelType: { id: string; version: string };
  requestedClips: readonly string[];
  artifacts: Readonly<Partial<Record<ArtifactKind, string>>>;
  stages: readonly StageRecord[];
  outputs: readonly { kind: string; uri: string; sha256?: string }[];
  validationReportIds: readonly string[];
}

export interface ValidationFinding {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  artifactId?: string;
  path?: string;
}

export interface ValidationReportArtifact extends ArtifactHeader<"validation-report"> {
  targetArtifactId: string;
  validator: { id: string; version: string };
  passed: boolean;
  findings: readonly ValidationFinding[];
}

export type PipelineArtifact =
  | ReferenceSetArtifact
  | ClassificationArtifact
  | ViewAnalysisArtifact
  | ExpectedPartObservationsArtifact
  | SemanticPartGraphArtifact
  | StyleDnaArtifact
  | ModelPlanArtifact
  | RigPlanArtifact
  | AnimationPlanArtifact
  | BuildManifestArtifact
  | ValidationReportArtifact;

export const invalidatesAfter: Readonly<Record<PipelineStage, readonly PipelineStage[]>> = {
  ingest: ["classify", "analyze-view", "observe-parts", "build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  classify: ["observe-parts", "build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "analyze-view": ["observe-parts", "build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "observe-parts": ["build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "build-part-graph": ["derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "derive-style-dna": ["plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "plan-model": ["plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "plan-rig": ["plan-animation", "rig", "animate", "validate", "export"],
  "plan-animation": ["animate", "validate", "export"],
  model: ["rig", "animate", "validate", "export"],
  rig: ["animate", "validate", "export"],
  animate: ["validate", "export"],
  validate: ["export"],
  export: [],
};

export function assertArtifactHeader(artifact: PipelineArtifact): void {
  if (artifact.schemaVersion !== "1.0.0") throw new Error(`Unsupported schema version: ${artifact.schemaVersion}`);
  if (!artifact.artifactId || !artifact.jobId) throw new Error("artifactId and jobId are required");
}
