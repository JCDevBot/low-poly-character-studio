import assert from "node:assert/strict";
import test from "node:test";

import {
  BASELINE_CHARACTER_ACTIONS,
  CHARACTER_CAPABILITY_CONTRACT_VERSION,
  STYLE_CONFIGURATION_SCHEMA,
  STYLE_KIT_CONTRACT_VERSION,
  ModelTypeManifestError,
  ModelTypeRegistry,
  StyleConfigurationError,
  StyleKitContractError,
  humanoidChibiStyleKitV1,
  humanoidChibiV1Manifest,
  modelTypeRegistry,
  styleConfigurationFromPreset,
  validateModelTypeManifest,
  validateStyleConfiguration,
  validateStyleKitContract,
} from "../src/index";

const validFixture = {
  ...humanoidChibiV1Manifest,
  id: "fixture/example-v1",
  name: "Fixture Model",
  styleKit: undefined,
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

test("humanoid manifest declares a versioned reusable Chibi style kit", () => {
  const styleKit = modelTypeRegistry.require("humanoid/chibi-v1").styleKit;
  assert.ok(styleKit);
  assert.equal(styleKit.contractVersion, STYLE_KIT_CONTRACT_VERSION);
  assert.equal(styleKit.id, "humanoid/chibi/style-kit");
  assert.equal(styleKit.rigId, "humanoid-basic-v1");
  assert.equal(styleKit.defaultPresetId, "gold-standard");
  assert.deepEqual(
    styleKit.slots.map((slot) => slot.id),
    ["body-shape", "head-shape", "eyes", "nose", "mouth", "ears", "hair", "torso-clothing", "hands", "feet"],
  );
  assert.ok(styleKit.controls.some((control) => control.id === "head-width"));
  assert.ok(styleKit.controls.some((control) => control.id === "arm-length"));
  assert.ok(styleKit.controls.every((control) => control.min <= control.default && control.default <= control.max));
});

test("gold-standard preset resolves to a complete reproducible style configuration", () => {
  const configuration = styleConfigurationFromPreset(humanoidChibiStyleKitV1);
  assert.equal(configuration.schema, STYLE_CONFIGURATION_SCHEMA);
  assert.equal(configuration.styleKitId, humanoidChibiStyleKitV1.id);
  assert.equal(configuration.styleKitVersion, humanoidChibiStyleKitV1.version);
  assert.equal(configuration.modelTypeId, "humanoid/chibi-v1");
  assert.equal(configuration.source, "preset");
  assert.equal(configuration.selections.eyes, "vertical-oval");
  assert.equal(configuration.parameters["head-width"], 1.02);
  assert.equal(
    Object.keys(configuration.parameters).length,
    humanoidChibiStyleKitV1.controls.length,
  );
});

test("style configurations reject unknown variants and out-of-range controls", () => {
  const valid = styleConfigurationFromPreset(humanoidChibiStyleKitV1);
  assert.throws(
    () => validateStyleConfiguration(humanoidChibiStyleKitV1, {
      ...valid,
      source: "user",
      selections: { ...valid.selections, eyes: "laser-eyes" },
      parameters: { ...valid.parameters, "head-width": 9 },
    }),
    (error: unknown) => {
      assert.ok(error instanceof StyleConfigurationError);
      assert.match(error.message, /unknown variant 'laser-eyes'/);
      assert.match(error.message, /head-width.*between 0.88 and 1.14/);
      return true;
    },
  );
});

test("style kit contracts reject unknown affected slots and incompatible rig variants", () => {
  assert.throws(
    () => validateStyleKitContract({
      ...humanoidChibiStyleKitV1,
      slots: humanoidChibiStyleKitV1.slots.map((slot, index) => index === 0
        ? {
            ...slot,
            variants: slot.variants.map((variant) => ({ ...variant, compatibleRigIds: ["some-other-rig"] })),
          }
        : slot),
      controls: humanoidChibiStyleKitV1.controls.map((control, index) => index === 0
        ? { ...control, affectedSlotIds: ["missing-slot"] }
        : control),
    }),
    (error: unknown) => {
      assert.ok(error instanceof StyleKitContractError);
      assert.match(error.message, /must include style-kit rig 'humanoid-basic-v1'/);
      assert.match(error.message, /references unknown slot 'missing-slot'/);
      return true;
    },
  );
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

test("manifest validation rejects a style kit attached to another model or rig", () => {
  assert.throws(
    () => validateModelTypeManifest({
      ...humanoidChibiV1Manifest,
      id: "other/model",
      rig: "other-rig",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ModelTypeManifestError);
      assert.match(error.message, /manifest\.styleKit\.modelTypeId/);
      assert.match(error.message, /manifest\.styleKit\.rigId/);
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
