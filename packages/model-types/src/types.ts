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

export interface ModelTypeExpectedPart {
  id: string;
  label: string;
  required: boolean;
  parentId: string | null;
  attachmentRole: "root" | "attached" | "surface";
  deformationRole: "rigid" | "skinned" | "presentation";
}

export interface ModelTypePipelineImplementations {
  classification: string | null;
  viewAnalysis: string | null;
  partObservation: string | null;
  styleDnaPlanner: string | null;
  modelPlanner: string | null;
  rigPlanner: string | null;
  animationPlanner: string | null;
  validation: readonly string[];
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
  expectedParts?: readonly ModelTypeExpectedPart[];
  implementations?: ModelTypePipelineImplementations;
  rig: string | null;
  animations: readonly string[];
  output: readonly OutputFormat[];
  examples?: readonly string[];
  limitations?: readonly string[];
  goldStandard?: ModelTypeGoldStandard;
}
