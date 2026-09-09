import { defineBaselineCharacterActions } from "../capability-contracts";
import { humanoidChibiStyleKitV1 } from "../style-kits/humanoid-chibi-v1";
import type { ModelTypeManifest } from "../types";

export const humanoidChibiV1Manifest = {
  id: "humanoid/chibi-v1",
  name: "Chibi Humanoid",
  version: "1.0.0",
  status: "available",
  description: "Friendly low-poly chibi humanoid based on the approved gold-standard body and surface language.",
  referenceSlots: [
    { id: "front", label: "Front", required: true, description: "Primary full-body front reference." },
    { id: "side", label: "Side", required: false, description: "Optional side view for depth and silhouette fidelity." },
    { id: "back", label: "Back", required: false, description: "Optional back view for hair, clothing, and rear silhouette fidelity." },
  ],
  capabilities: { rigged: true, animated: true, materials: true },
  characterCapabilities: {
    contractVersion: "character-capability-contract/v1",
    semanticActions: defineBaselineCharacterActions({
      neutral: "a-pose",
      idle: "idle",
      walk: "walk",
    }),
  },
  styleKit: humanoidChibiStyleKitV1,
  expectedParts: [
    { id: "body", label: "Body", required: true, parentId: null, attachmentRole: "root", deformationRole: "skinned", functionalRoles: ["core"] },
    { id: "head", label: "Head", required: true, parentId: "body", attachmentRole: "attached", deformationRole: "skinned", functionalRoles: ["sensor", "articulator"] },
    { id: "hair", label: "Hair", required: true, parentId: "head", attachmentRole: "surface", deformationRole: "presentation", functionalRoles: ["presentation"] },
    { id: "shirt", label: "A-frame undershirt", required: true, parentId: "body", attachmentRole: "surface", deformationRole: "skinned", functionalRoles: ["presentation"] },
    { id: "briefs", label: "Boxer briefs", required: true, parentId: "body", attachmentRole: "surface", deformationRole: "skinned", functionalRoles: ["presentation"] },
    { id: "left-arm", label: "Left arm", required: true, parentId: "body", attachmentRole: "attached", deformationRole: "skinned", functionalRoles: ["articulator", "manipulator", "grasper"] },
    { id: "right-arm", label: "Right arm", required: true, parentId: "body", attachmentRole: "attached", deformationRole: "skinned", functionalRoles: ["articulator", "manipulator", "grasper"] },
    { id: "left-leg", label: "Left leg", required: true, parentId: "body", attachmentRole: "attached", deformationRole: "skinned", functionalRoles: ["locomotor", "support-contact", "articulator"] },
    { id: "right-leg", label: "Right leg", required: true, parentId: "body", attachmentRole: "attached", deformationRole: "skinned", functionalRoles: ["locomotor", "support-contact", "articulator"] },
  ],
  implementations: {
    classification: "manual-or-deterministic-classifier-v1",
    viewAnalysis: "humanoid-front-view-analysis-v1",
    partObservation: "humanoid-chibi-part-observer-v1",
    styleDnaPlanner: "humanoid-chibi-style-dna-v1",
    modelPlanner: "humanoid-chibi-model-plan-v1",
    rigPlanner: "humanoid-basic-rig-plan-v1",
    animationPlanner: "humanoid-basic-animation-plan-v1",
    validation: ["humanoid-structure-v1", "gltf-2.0-v1"],
  },
  rig: "humanoid-basic-v1",
  animations: ["a-pose", "idle", "walk", "wave"],
  output: ["glb"],
  goldStandard: {
    specificationPath: "docs/gold-standard-humanoid-chibi.md",
    referenceImagePath: "docs/reference/gold-standard-humanoid-chibi.png",
    headsTall: { min: 2.6, max: 2.8 },
    triangleBudget: { min: 1500, max: 3000, target: 2000 },
    styleConstraints: [
      "dominant oversized head with a broad softly rounded face",
      "narrow gently sloped shoulders and compact torso",
      "short sturdy legs with oversized simplified hands and bare feet",
      "large vertical black oval eyes with minimal nose and mouth detail",
      "separate faceted hair cap with a chunky irregular fringe",
      "deliberately faceted low-poly geometry with soft hand-painted materials",
    ],
  },
} as const satisfies ModelTypeManifest;
