import assert from "node:assert/strict";
import test from "node:test";
import type { ReferenceSetArtifact } from "../../pipeline-contracts/src/artifacts";
import {
  DeterministicReferenceAnalysisProvider,
  analyzeReferenceSet,
  type ReferenceAnalysisProvider,
} from "../src/index";

const referenceSet: ReferenceSetArtifact = {
  kind: "reference-set",
  schemaVersion: "1.0.0",
  artifactId: "reference-set-1",
  jobId: "semantic-analysis-fixture",
  createdAt: "2026-07-24T00:00:00.000Z",
  producer: { id: "test", version: "1.0.0" },
  references: [{
    id: "front-1",
    slot: "front",
    uri: "docs/reference/gold-standard-humanoid-chibi.png",
    sha256: "synthetic-hash",
    mediaType: "image/png",
    width: 1024,
    height: 1024,
  }],
};

const context = {
  jobId: referenceSet.jobId,
  createdAt: "2026-07-24T00:00:01.000Z",
};

test("front humanoid reference emits separate persisted semantic artifacts", () => {
  const result = analyzeReferenceSet(referenceSet, context);
  assert.equal(result.classification.recommendation.value, "humanoid/chibi-v1");
  assert.equal(result.classification.confirmationState, "pending");
  assert.equal(result.classification.recommendation.confidence, 0.72);
  assert.equal(result.viewAnalysis.kind, "view-analysis");
  assert.equal(result.viewAnalysis.role.value, "front");
  assert.notEqual(result.viewAnalysis.artifactId, result.classification.artifactId);
  assert.ok(result.expectedParts.observations.some((part) => part.partId === "hair" && part.state === "observed"));
  assert.ok(result.partGraph.nodes.some((node) => node.expectedPartId === "hair" && node.parentId?.endsWith(":head")));
  assert.equal(result.styleDna.modelTypeId, "humanoid/chibi-v1");
  assert.equal(result.styleDna.values.expectedPartCount.origin, "measured");
});

test("user confirmation and override remain explicit provenance", () => {
  const confirmed = analyzeReferenceSet(
    referenceSet,
    context,
    new DeterministicReferenceAnalysisProvider({ modelTypeId: "humanoid/chibi-v1", state: "confirmed" }),
  );
  assert.equal(confirmed.classification.confirmationState, "confirmed");
  assert.equal(confirmed.classification.recommendation.origin, "user-confirmed");
  assert.equal(confirmed.classification.recommendation.confirmed, true);

  const overridden = analyzeReferenceSet(
    referenceSet,
    context,
    new DeterministicReferenceAnalysisProvider({ modelTypeId: "animal/quadruped-v0", state: "overridden", note: "Manual correction" }),
  );
  assert.equal(overridden.classification.confirmationState, "overridden");
  assert.equal(overridden.classification.recommendation.origin, "user-overridden");
  assert.equal(overridden.classification.recommendation.value, "animal/quadruped-v0");
});

test("analysis provider is replaceable without changing the result contract", () => {
  const fallback = new DeterministicReferenceAnalysisProvider({ modelTypeId: "humanoid/chibi-v1", state: "confirmed" });
  const provider: ReferenceAnalysisProvider = {
    id: "fixture-provider",
    version: "9.0.0",
    analyze(input, providerContext) {
      const result = fallback.analyze(input, providerContext);
      return {
        ...result,
        classification: {
          ...result.classification,
          producer: { id: this.id, version: this.version },
        },
      };
    },
  };
  const result = analyzeReferenceSet(referenceSet, context, provider);
  assert.equal(result.classification.producer.id, "fixture-provider");
  assert.equal(result.classification.kind, "classification");
});

test("unknown model-type overrides fail before downstream artifacts", () => {
  assert.throws(
    () => analyzeReferenceSet(referenceSet, context, new DeterministicReferenceAnalysisProvider({ modelTypeId: "missing/type", state: "overridden" })),
    /Unknown model type override/,
  );
});
