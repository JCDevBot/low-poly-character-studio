import type { ModelTypeManifest } from "../types";

export const quadrupedPlannedV0Manifest = {
  id: "animal/quadruped-v0",
  name: "Stylized Quadruped",
  version: "0.1.0",
  status: "planned",
  description: "Planned low-poly four-legged animal model type used to verify registry-driven catalog behavior.",
  referenceSlots: [
    {
      id: "side",
      label: "Side",
      required: true,
      description: "Primary full-body side reference.",
    },
    {
      id: "front",
      label: "Front",
      required: false,
      description: "Optional front view for body width and facial placement.",
    },
  ],
  capabilities: {
    rigged: false,
    animated: false,
    materials: false,
  },
  rig: null,
  animations: [],
  output: ["glb"],
} as const satisfies ModelTypeManifest;
