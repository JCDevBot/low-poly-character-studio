import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("humanoid manifest declares expected parts and stable planners", () => {
  const manifest = modelTypeRegistry.require("humanoid/chibi-v1");
  assert.ok(manifest.expectedParts?.some((part) => part.id === "body" && part.parentId === null));
  assert.ok(manifest.expectedParts?.some((part) => part.id === "hair" && part.deformationRole === "presentation"));
  assert.equal(manifest.implementations?.modelPlanner, "humanoid-chibi-model-plan-v1");
  assert.equal(manifest.implementations?.rigPlanner, "humanoid-basic-rig-plan-v1");
  assert.equal(manifest.implementations?.animationPlanner, "humanoid-basic-animation-plan-v1");
  assert.deepEqual(manifest.implementations?.validation, ["humanoid-structure-v1", "gltf-2.0-v1"]);
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
