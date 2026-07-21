export type ReferenceSlotId = "front" | "side" | "back" | string;
export type OutputFormat = "glb" | string;

export interface ModelTypeReferenceSlot {
  id: ReferenceSlotId;
  label: string;
  required: boolean;
  description?: string;
}

export interface ModelTypeCapabilities {
  rigged: boolean;
  animated: boolean;
  materials: boolean;
}

export interface NumericRange {
  min: number;
  max: number;
  target?: number;
}

export interface ModelTypeGoldStandard {
  specificationPath: string;
  referenceImagePath: string;
  headsTall: NumericRange;
  triangleBudget: Required<NumericRange>;
  styleConstraints: readonly string[];
}

export interface ModelTypeManifest {
  id: string;
  name: string;
  version: string;
  status: "available" | "experimental" | "planned";
  description: string;
  referenceSlots: readonly ModelTypeReferenceSlot[];
  analysisAdapter?: string | null;
  capabilities: ModelTypeCapabilities;
  rig: string | null;
  animations: readonly string[];
  output: readonly OutputFormat[];
  goldStandard?: ModelTypeGoldStandard;
}
