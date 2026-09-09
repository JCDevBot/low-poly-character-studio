import assert from "node:assert/strict";
import test from "node:test";

import {
  BASELINE_CHARACTER_ACTIONS,
  CHARACTER_CAPABILITY_CONTRACT_VERSION,
  ModelTypeManifestError,
  ModelTypeRegistry,
  humanoidChibiV1Manifest,
  modelTypeRegistry,
  validateModelTypeManifest,
} from "../src/index";

const validFixture = {
  ...humanoidChibiV1Manifest,
  id: "fixture/example-v1",
  name: "Fixture Model",
  goldStandard: undefined,
};

test("registry lists available and planned model types", () => {
  assert.deepEqual(modelTypeRegistry.list().map((manifest) => manifest.id), [
    "humanoid/chibi-v1",
    "animal/quadruped-v0",
  ]);
  assert.equal(modelTypeRegistry.require("humanoid/chibi-v1").name, "Chibi Humanoid");
  assert.equal(modelTypeRegistry.require("animal/quadruped-v0").status, "planned");
});

test("humanoid manifest defines required and optional reference slots", () => {
  const manifest = modelTypeRegistry.require("humanoid/chibi-v1");
  assert.deepEqual(
    manifest.referenceSlots.map(({ id, required }) => ({ id, required })),
    [
      { id: "front", required: true },
      { id: "side", required: false },
      { id: "back", required: false },
    ],
  );
});

test("humanoid manifest declares expected parts, functional roles, and stable planners", () => {
  const manifest = modelTypeRegistry.require("humanoid/chibi-v1");
  assert.ok(manifest.expectedParts?.some((part) => part.id === "body" && part.parentId === null));
  assert.ok(manifest.expectedParts?.some((part) => part.id === "hair" && part.deformationRole === "presentation"));
  assert.ok(manifest.expectedParts?.some((part) => part.id === "left-arm" && part.functionalRoles?.includes("grasper")));
  assert.ok(manifest.expectedParts?.some((part) => part.id === "left-leg" && part.functionalRoles?.includes("locomotor")));
  assert.equal(manifest.implementations?.modelPlanner, "humanoid-chibi-model-plan-v1");
  assert.equal(manifest.implementations?.rigPlanner, "humanoid-basic-rig-plan-v1");
  assert.equal(manifest.implementations?.animationPlanner, "humanoid-basic-animation-plan-v1");
  assert.deepEqual(manifest.implementations?.validation, ["humanoid-structure-v1", "gltf-2.0-v1"]);
});

test("humanoid manifest declares the baseline semantic character action contract", () => {
  const contract = modelTypeRegistry.require("humanoid/chibi-v1").characterCapabilities;
  assert.ok(contract);
  assert.equal(contract.contractVersion, CHARACTER_CAPABILITY_CONTRACT_VERSION);
  assert.deepEqual(contract.semanticActions.map((action) => action.id), BASELINE_CHARACTER_ACTIONS);
  assert.ok(contract.semanticActions.every((action) => action.required));
  assert.equal(contract.semanticActions.find((action) => action.id === "neutral")?.implementationId, "a-pose");
  assert.equal(contract.semanticActions.find((action) => action.id === "idle")?.implementationId, "idle");
  assert.equal(contract.semanticActions.find((action) => action.id === "run")?.implementationId, null);
});

test("humanoid manifest preserves the approved gold-standard constraints", () => {
  const goldStandard = modelTypeRegistry.require("humanoid/chibi-v1").goldStandard;
  assert.ok(goldStandard);
  assert.equal(goldStandard.specificationPath, "docs/gold-standard-humanoid-chibi.md");
  assert.equal(goldStandard.referenceImagePath, "docs/reference/gold-standard-humanoid-chibi.png");
  assert.deepEqual(goldStandard.headsTall, { min: 2.6, max: 2.8 });
  assert.deepEqual(goldStandard.triangleBudget, { min: 1500, max: 3000, target: 2000 });
});

test("invalid manifests report actionable field paths", () => {
  assert.throws(
    () => validateModelTypeManifest({ ...validFixture, version: "one", output: [] }),
    (error: unknown) => {
      assert.ok(error instanceof ModelTypeManifestError);
      assert.match(error.message, /manifest\.version/);
      assert.match(error.message, /manifest\.output/);
      return true;
    },
  );
});

test("character manifests reject missing baseline semantic actions", () => {
  const semanticActions = humanoidChibiV1Manifest.characterCapabilities.semanticActions.filter(
    (action) => action.id !== "crawl",
  );
  assert.throws(
    () => validateModelTypeManifest({
      ...validFixture,
      characterCapabilities: {
        ...validFixture.characterCapabilities,
        semanticActions,
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof ModelTypeManifestError);
      assert.match(error.message, /missing required baseline semantic action 'crawl'/);
      return true;
    },
  );
});

test("character manifests reject malformed functional roles", () => {
  const expectedParts = humanoidChibiV1Manifest.expectedParts.map((part) =>
    part.id === "body" ? { ...part, functionalRoles: ["teleporter"] } : part,
  );
  assert.throws(
    () => validateModelTypeManifest({ ...validFixture, expectedParts }),
    (error: unknown) => {
      assert.ok(error instanceof ModelTypeManifestError);
      assert.match(error.message, /manifest\.expectedParts\[0\]\.functionalRoles\[0\]/);
      return true;
    },
  );
});

test("duplicate manifest ids fail registry construction", () => {
  assert.throws(
    () => new ModelTypeRegistry([validFixture, { ...validFixture }]),
    /duplicate model type id 'fixture\/example-v1'/,
  );
});

test("unknown ids include available choices", () => {
  assert.throws(
    () => modelTypeRegistry.require("missing/type"),
    /Available model types: humanoid\/chibi-v1, animal\/quadruped-v0/,
  );
});
