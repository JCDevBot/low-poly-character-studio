import type {
  ModelTypeCapabilities,
  ModelTypeExpectedPart,
  ModelTypeGoldStandard,
  ModelTypeManifest,
  ModelTypePipelineImplementations,
  ModelTypeReferenceSlot,
  NumericRange,
} from "./types";

export interface ManifestValidationIssue { path: string; message: string }

export class ModelTypeManifestError extends Error {
  readonly issues: readonly ManifestValidationIssue[];
  constructor(issues: readonly ManifestValidationIssue[]) {
    super(`Invalid model type manifest:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`);
    this.name = "ModelTypeManifestError";
    this.issues = issues;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function readString(source: Record<string, unknown>, key: string, path: string, issues: ManifestValidationIssue[]): string {
  const value = source[key];
  if (!nonEmptyString(value)) {
    issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
    return "";
  }
  return value;
}

function readNullableString(value: unknown, path: string, issues: ManifestValidationIssue[]): string | null {
  if (value === null) return null;
  if (!nonEmptyString(value)) {
    issues.push({ path, message: "must be a non-empty string or null" });
    return null;
  }
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string, path: string, issues: ManifestValidationIssue[]): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    issues.push({ path: `${path}.${key}`, message: "must be a boolean" });
    return false;
  }
  return value;
}

function validateRange(value: unknown, path: string, issues: ManifestValidationIssue[], requireTarget = false): NumericRange {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return { min: 0, max: 0 };
  }
  const min = value.min;
  const max = value.max;
  const target = value.target;
  if (typeof min !== "number" || !Number.isFinite(min)) issues.push({ path: `${path}.min`, message: "must be a finite number" });
  if (typeof max !== "number" || !Number.isFinite(max)) issues.push({ path: `${path}.max`, message: "must be a finite number" });
  if (requireTarget && (typeof target !== "number" || !Number.isFinite(target))) issues.push({ path: `${path}.target`, message: "must be a finite number" });
  if (typeof min === "number" && typeof max === "number" && min > max) issues.push({ path, message: "min must be less than or equal to max" });
  if (typeof target === "number" && typeof min === "number" && typeof max === "number" && (target < min || target > max)) {
    issues.push({ path: `${path}.target`, message: "must fall within min and max" });
  }
  return { min: typeof min === "number" ? min : 0, max: typeof max === "number" ? max : 0, ...(typeof target === "number" ? { target } : {}) };
}

function validateStringArray(value: unknown, path: string, issues: ManifestValidationIssue[]): readonly string[] {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "must be an array" });
    return [];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!nonEmptyString(entry)) {
      issues.push({ path: `${path}[${index}]`, message: "must be a non-empty string" });
    } else if (seen.has(entry)) {
      issues.push({ path: `${path}[${index}]`, message: `duplicate value '${entry}'` });
    } else {
      seen.add(entry);
      result.push(entry);
    }
  });
  return result;
}

function validateReferenceSlots(value: unknown, issues: ManifestValidationIssue[]): readonly ModelTypeReferenceSlot[] {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path: "manifest.referenceSlots", message: "must be a non-empty array" });
    return [];
  }
  const seen = new Set<string>();
  return value.map((slot, index) => {
    const path = `manifest.referenceSlots[${index}]`;
    if (!isRecord(slot)) {
      issues.push({ path, message: "must be an object" });
      return { id: "", label: "", required: false };
    }
    const id = readString(slot, "id", path, issues);
    const label = readString(slot, "label", path, issues);
    const required = readBoolean(slot, "required", path, issues);
    if (id && seen.has(id)) issues.push({ path: `${path}.id`, message: `duplicate reference slot '${id}'` });
    seen.add(id);
    return { id, label, required, ...(nonEmptyString(slot.description) ? { description: slot.description } : {}) };
  });
}

function validateCapabilities(value: unknown, issues: ManifestValidationIssue[]): ModelTypeCapabilities {
  if (!isRecord(value)) {
    issues.push({ path: "manifest.capabilities", message: "must be an object" });
    return { rigged: false, animated: false, materials: false };
  }
  return {
    rigged: readBoolean(value, "rigged", "manifest.capabilities", issues),
    animated: readBoolean(value, "animated", "manifest.capabilities", issues),
    materials: readBoolean(value, "materials", "manifest.capabilities", issues),
  };
}

function validateExpectedParts(value: unknown, issues: ManifestValidationIssue[]): readonly ModelTypeExpectedPart[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path: "manifest.expectedParts", message: "must be a non-empty array" });
    return [];
  }
  const seen = new Set<string>();
  const parts = value.map((part, index): ModelTypeExpectedPart => {
    const path = `manifest.expectedParts[${index}]`;
    if (!isRecord(part)) {
      issues.push({ path, message: "must be an object" });
      return { id: "", label: "", required: false, parentId: null, attachmentRole: "attached", deformationRole: "rigid" };
    }
    const id = readString(part, "id", path, issues);
    if (id && seen.has(id)) issues.push({ path: `${path}.id`, message: `duplicate expected part '${id}'` });
    seen.add(id);
    const parentId = part.parentId === null ? null : readNullableString(part.parentId, `${path}.parentId`, issues);
    const attachmentRole = part.attachmentRole;
    if (attachmentRole !== "root" && attachmentRole !== "attached" && attachmentRole !== "surface") {
      issues.push({ path: `${path}.attachmentRole`, message: "must be root, attached, or surface" });
    }
    const deformationRole = part.deformationRole;
    if (deformationRole !== "rigid" && deformationRole !== "skinned" && deformationRole !== "presentation") {
      issues.push({ path: `${path}.deformationRole`, message: "must be rigid, skinned, or presentation" });
    }
    return {
      id,
      label: readString(part, "label", path, issues),
      required: readBoolean(part, "required", path, issues),
      parentId,
      attachmentRole: attachmentRole === "root" || attachmentRole === "surface" ? attachmentRole : "attached",
      deformationRole: deformationRole === "skinned" || deformationRole === "presentation" ? deformationRole : "rigid",
    };
  });
  const ids = new Set(parts.map((part) => part.id));
  parts.forEach((part, index) => {
    if (part.parentId !== null && !ids.has(part.parentId)) {
      issues.push({ path: `manifest.expectedParts[${index}].parentId`, message: `unknown parent '${part.parentId}'` });
    }
  });
  return parts;
}

function validateImplementations(value: unknown, issues: ManifestValidationIssue[]): ModelTypePipelineImplementations | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issues.push({ path: "manifest.implementations", message: "must be an object" });
    return undefined;
  }
  return {
    classification: readNullableString(value.classification, "manifest.implementations.classification", issues),
    viewAnalysis: readNullableString(value.viewAnalysis, "manifest.implementations.viewAnalysis", issues),
    partObservation: readNullableString(value.partObservation, "manifest.implementations.partObservation", issues),
    styleDnaPlanner: readNullableString(value.styleDnaPlanner, "manifest.implementations.styleDnaPlanner", issues),
    modelPlanner: readNullableString(value.modelPlanner, "manifest.implementations.modelPlanner", issues),
    rigPlanner: readNullableString(value.rigPlanner, "manifest.implementations.rigPlanner", issues),
    animationPlanner: readNullableString(value.animationPlanner, "manifest.implementations.animationPlanner", issues),
    validation: validateStringArray(value.validation, "manifest.implementations.validation", issues),
  };
}

function validateGoldStandard(value: unknown, issues: ManifestValidationIssue[]): ModelTypeGoldStandard | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issues.push({ path: "manifest.goldStandard", message: "must be an object" });
    return undefined;
  }
  const triangleBudget = validateRange(value.triangleBudget, "manifest.goldStandard.triangleBudget", issues, true);
  return {
    specificationPath: readString(value, "specificationPath", "manifest.goldStandard", issues),
    referenceImagePath: readString(value, "referenceImagePath", "manifest.goldStandard", issues),
    headsTall: validateRange(value.headsTall, "manifest.goldStandard.headsTall", issues),
    triangleBudget: { min: triangleBudget.min, max: triangleBudget.max, target: triangleBudget.target ?? 0 },
    styleConstraints: validateStringArray(value.styleConstraints, "manifest.goldStandard.styleConstraints", issues),
  };
}

export function validateModelTypeManifest(input: unknown): ModelTypeManifest {
  const issues: ManifestValidationIssue[] = [];
  if (!isRecord(input)) throw new ModelTypeManifestError([{ path: "manifest", message: "must be an object" }]);

  const id = readString(input, "id", "manifest", issues);
  const name = readString(input, "name", "manifest", issues);
  const version = readString(input, "version", "manifest", issues);
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) issues.push({ path: "manifest.version", message: "must use semantic version format x.y.z" });
  const status = input.status;
  if (status !== "available" && status !== "experimental" && status !== "planned") issues.push({ path: "manifest.status", message: "must be available, experimental, or planned" });
  const description = readString(input, "description", "manifest", issues);
  const referenceSlots = validateReferenceSlots(input.referenceSlots, issues);
  const capabilities = validateCapabilities(input.capabilities, issues);
  const animations = validateStringArray(input.animations, "manifest.animations", issues);
  const output = validateStringArray(input.output, "manifest.output", issues);
  if (!output.includes("glb")) issues.push({ path: "manifest.output", message: "must include 'glb'" });
  const rig = input.rig;
  if (rig !== null && !nonEmptyString(rig)) issues.push({ path: "manifest.rig", message: "must be a non-empty string or null" });
  if (capabilities.rigged && !nonEmptyString(rig)) issues.push({ path: "manifest.rig", message: "is required when rigged capability is enabled" });
  if (capabilities.animated && animations.length === 0) issues.push({ path: "manifest.animations", message: "must not be empty when animated capability is enabled" });
  if (!referenceSlots.some((slot) => slot.required)) issues.push({ path: "manifest.referenceSlots", message: "must include at least one required slot" });

  const manifest: ModelTypeManifest = {
    id,
    name,
    version,
    status: status === "experimental" || status === "planned" ? status : "available",
    description,
    referenceSlots,
    capabilities,
    expectedParts: validateExpectedParts(input.expectedParts, issues),
    implementations: validateImplementations(input.implementations, issues),
    rig: nonEmptyString(rig) ? rig : null,
    animations,
    output,
    goldStandard: validateGoldStandard(input.goldStandard, issues),
  };

  if (issues.length > 0) throw new ModelTypeManifestError(issues);
  return Object.freeze(manifest);
}
