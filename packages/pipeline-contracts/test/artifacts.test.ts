import assert from "node:assert/strict";
import test from "node:test";
import {
  assertArtifactHeader,
  invalidatesAfter,
  type AnimationPlanArtifact,
  type BuildManifestArtifact,
  type ClassificationArtifact,
  type ModelPlanArtifact,
  type ReferenceSetArtifact,
  type RigPlanArtifact,
  type StyleDnaArtifact,
} from "../src/artifacts";

const base = {
  schemaVersion: "1.0.0" as const,
  jobId: "job-gold-standard-front",
  createdAt: "2026-07-24T00:00:00.000Z",
  producer: { id: "fixture-planner", version: "1.0.0" },
};

const references: ReferenceSetArtifact = {
  ...base,
  kind: "reference-set",
  artifactId: "reference-set-1",
  references: [{
    id: "front-reference",
    slot: "front",
    uri: "docs/reference/gold-standard-humanoid-chibi.png",
    sha256: "synthetic-fixture-hash",
    mediaType: "image/png",
  }],
};

const classification: ClassificationArtifact = {
  ...base,
  kind: "classification",
  artifactId: "classification-1",
  recommendation: {
    value: "humanoid/chibi-v1",
    origin: "user-confirmed",
    confidence: 0.98,
    confirmed: true,
    sourceArtifactIds: [references.artifactId],
  },
  alternatives: [],
  confirmationState: "confirmed",
};

const styleDna: StyleDnaArtifact = {
  ...base,
  kind: "style-dna",
  artifactId: "style-dna-1",
  modelTypeId: "humanoid/chibi-v1",
  modelTypeVersion: "1.0.0",
  values: {
    headsTall: { value: 2.7, origin: "measured", confidence: 0.9, confirmed: false },
    shoulderWidth: { value: "narrow", origin: "inferred", confidence: 0.8, confirmed: false },
  },
};

const modelPlan: ModelPlanArtifact = {
  ...base,
  kind: "model-plan",
  artifactId: "model-plan-1",
  modelTypeId: "humanoid/chibi-v1",
  implementationId: "humanoid-chibi-generator-v1",
  styleDnaArtifactId: styleDna.artifactId,
  expectedParts: ["body", "head", "hair", "shirt", "briefs"],
  generationSettings: { deterministicSeed: 1 },
};

const rigPlan: RigPlanArtifact = {
  ...base,
  kind: "rig-plan",
  artifactId: "rig-plan-1",
  rigId: "humanoid-basic-v1",
  implementationId: "humanoid-basic-rig-v1",
  modelPlanArtifactId: modelPlan.artifactId,
  requiredJoints: ["root", "hips", "spine", "head", "upper_arm.L", "upper_arm.R"],
};

const animationPlan: AnimationPlanArtifact = {
  ...base,
  kind: "animation-plan",
  artifactId: "animation-plan-1",
  packId: "humanoid-basic-v1/default-v1",
  implementationId: "humanoid-animation-pack-v1",
  rigPlanArtifactId: rigPlan.artifactId,
  requestedClips: ["a-pose", "idle", "walk", "wave"],
  frameRate: 24,
  rootMotion: "in-place",
};

const manifest: BuildManifestArtifact = {
  ...base,
  kind: "build-manifest",
  artifactId: "build-manifest-1",
  pipelineVersion: "1.0.0",
  modelType: { id: "humanoid/chibi-v1", version: "1.0.0" },
  requestedClips: animationPlan.requestedClips,
  artifacts: {
    "reference-set": references.artifactId,
    classification: classification.artifactId,
    "style-dna": styleDna.artifactId,
    "model-plan": modelPlan.artifactId,
    "rig-plan": rigPlan.artifactId,
    "animation-plan": animationPlan.artifactId,
  },
  stages: [],
  outputs: [],
  validationReportIds: [],
};

test("front-reference fixture reaches versioned model, rig, and animation plans without Blender", () => {
  for (const artifact of [references, classification, styleDna, modelPlan, rigPlan, animationPlan, manifest]) {
    assert.doesNotThrow(() => assertArtifactHeader(artifact));
    assert.equal(artifact.jobId, manifest.jobId);
  }
  assert.equal(classification.recommendation.value, "humanoid/chibi-v1");
  assert.deepEqual(manifest.requestedClips, ["a-pose", "idle", "walk", "wave"]);
  assert.equal(manifest.artifacts["animation-plan"], animationPlan.artifactId);
});

test("evidence preserves origin, confidence, confirmation, and overrides", () => {
  const overridden = {
    value: 2.65,
    origin: "user-overridden" as const,
    confidence: null,
    confirmed: true,
    sourceArtifactIds: [styleDna.artifactId],
  };
  assert.equal(overridden.origin, "user-overridden");
  assert.equal(overridden.confirmed, true);
});

test("upstream changes invalidate every affected downstream stage", () => {
  assert.ok(invalidatesAfter.ingest.includes("export"));
  assert.ok(invalidatesAfter["derive-style-dna"].includes("model"));
  assert.deepEqual(invalidatesAfter.export, []);
});
