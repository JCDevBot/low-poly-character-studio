import type { ModelTypeManifest } from "../types";

export const humanoidChibiV1Manifest = {
  id: "humanoid/chibi-v1",
  name: "Chibi Humanoid",
  version: "1.0.0",
  status: "available",
  description: "Friendly low-poly chibi humanoid based on the approved gold-standard body and surface language.",
  referenceSlots: [
    {
      id: "front",
      label: "Front",
      required: true,
      description: "Primary full-body front reference.",
    },
    {
      id: "side",
      label: "Side",
      required: false,
      description: "Optional side view for depth and silhouette fidelity.",
    },
    {
      id: "back",
      label: "Back",
      required: false,
      description: "Optional back view for hair, clothing, and rear silhouette fidelity.",
    },
  ],
  capabilities: {
    rigged: true,
    animated: true,
    materials: true,
  },
  rig: "humanoid-basic-v1",
  animations: ["a-pose", "idle", "walk", "wave"],
  output: ["glb"],
  goldStandard: {
    specificationPath: "docs/gold-standard-humanoid-chibi.md",
    referenceImagePath: "docs/reference/gold-standard-humanoid-chibi.png",
    headsTall: {
      min: 2.6,
      max: 2.8,
    },
    triangleBudget: {
      min: 1500,
      max: 3000,
      target: 2000,
    },
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
