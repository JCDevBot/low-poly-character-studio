export const STYLE_KIT_CONTRACT_VERSION = "character-style-kit/v1" as const;
export const STYLE_CONFIGURATION_SCHEMA = "character-style-configuration/v1" as const;

export type StyleKitSlotKind = "structural" | "presentation";
export type StyleKitDeformationRole = "rigid" | "skinned" | "presentation";
export type StyleConfigurationSource = "preset" | "reference-analysis" | "user";

export interface StyleKitVariantDeclaration {
  id: string;
  label: string;
  sourceId: string;
  compatibleRigIds: readonly string[];
  materialSlots: readonly string[];
}

export interface StyleKitSlotDeclaration {
  id: string;
  label: string;
  required: boolean;
  kind: StyleKitSlotKind;
  parentPartId: string | null;
  anchorId: string;
  deformationRole: StyleKitDeformationRole;
  variants: readonly StyleKitVariantDeclaration[];
}

export interface StyleKitControlDeclaration {
  id: string;
  label: string;
  implementationKey: string;
  min: number;
  max: number;
  default: number;
  affectedSlotIds: readonly string[];
  affectedAnchorIds: readonly string[];
}

export interface StyleKitPresetDeclaration {
  id: string;
  label: string;
  selections: Readonly<Record<string, string>>;
  parameters: Readonly<Record<string, number>>;
}

export interface ModelTypeStyleKitContract {
  contractVersion: typeof STYLE_KIT_CONTRACT_VERSION;
  id: string;
  version: string;
  modelTypeId: string;
  rigId: string;
  slots: readonly StyleKitSlotDeclaration[];
  controls: readonly StyleKitControlDeclaration[];
  presets: readonly StyleKitPresetDeclaration[];
  defaultPresetId: string;
}

export interface CharacterStyleConfiguration {
  schema: typeof STYLE_CONFIGURATION_SCHEMA;
  styleKitId: string;
  styleKitVersion: string;
  modelTypeId: string;
  source: StyleConfigurationSource;
  selections: Readonly<Record<string, string>>;
  parameters: Readonly<Record<string, number>>;
}

export interface StyleKitValidationIssue {
  path: string;
  message: string;
}

export class StyleKitContractError extends Error {
  readonly issues: readonly StyleKitValidationIssue[];

  constructor(issues: readonly StyleKitValidationIssue[]) {
    super(`Invalid style kit:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`);
    this.name = "StyleKitContractError";
    this.issues = issues;
  }
}

export class StyleConfigurationError extends Error {
  readonly issues: readonly StyleKitValidationIssue[];

  constructor(issues: readonly StyleKitValidationIssue[]) {
    super(`Invalid style configuration:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`);
    this.name = "StyleConfigurationError";
    this.issues = issues;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function readString(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: StyleKitValidationIssue[],
): string {
  const value = source[key];
  if (!nonEmptyString(value)) {
    issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
    return "";
  }
  return value;
}

function validateStringArray(
  value: unknown,
  path: string,
  issues: StyleKitValidationIssue[],
  requireNonEmpty = true,
): readonly string[] {
  if (!Array.isArray(value) || (requireNonEmpty && value.length === 0)) {
    issues.push({ path, message: requireNonEmpty ? "must be a non-empty array" : "must be an array" });
    return [];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!nonEmptyString(entry)) {
      issues.push({ path: `${path}[${index}]`, message: "must be a non-empty string" });
      return;
    }
    if (seen.has(entry)) {
      issues.push({ path: `${path}[${index}]`, message: `duplicate value '${entry}'` });
      return;
    }
    seen.add(entry);
    result.push(entry);
  });
  return result;
}

function validateCompleteSelections(
  selections: unknown,
  slots: readonly StyleKitSlotDeclaration[],
  path: string,
  issues: StyleKitValidationIssue[],
): Readonly<Record<string, string>> {
  if (!isRecord(selections)) {
    issues.push({ path, message: "must be an object" });
    return {};
  }
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const result: Record<string, string> = {};
  for (const [slotId, variantId] of Object.entries(selections)) {
    const slot = slotById.get(slotId);
    if (!slot) {
      issues.push({ path: `${path}.${slotId}`, message: `unknown style-kit slot '${slotId}'` });
      continue;
    }
    if (!nonEmptyString(variantId) || !slot.variants.some((variant) => variant.id === variantId)) {
      issues.push({ path: `${path}.${slotId}`, message: `unknown variant '${String(variantId)}' for slot '${slotId}'` });
      continue;
    }
    result[slotId] = variantId;
  }
  slots.filter((slot) => slot.required).forEach((slot) => {
    if (!result[slot.id]) {
      issues.push({ path: `${path}.${slot.id}`, message: "required slot must select a variant" });
    }
  });
  return result;
}

function validateCompleteParameters(
  parameters: unknown,
  controls: readonly StyleKitControlDeclaration[],
  path: string,
  issues: StyleKitValidationIssue[],
): Readonly<Record<string, number>> {
  if (!isRecord(parameters)) {
    issues.push({ path, message: "must be an object" });
    return {};
  }
  const controlById = new Map(controls.map((control) => [control.id, control]));
  const result: Record<string, number> = {};
  for (const [controlId, value] of Object.entries(parameters)) {
    const control = controlById.get(controlId);
    if (!control) {
      issues.push({ path: `${path}.${controlId}`, message: `unknown style-kit control '${controlId}'` });
      continue;
    }
    if (!finiteNumber(value)) {
      issues.push({ path: `${path}.${controlId}`, message: "must be a finite number" });
      continue;
    }
    if (value < control.min || value > control.max) {
      issues.push({
        path: `${path}.${controlId}`,
        message: `must be between ${control.min} and ${control.max}`,
      });
      continue;
    }
    result[controlId] = value;
  }
  controls.forEach((control) => {
    if (!(control.id in result)) {
      issues.push({ path: `${path}.${control.id}`, message: "complete configuration must include this control" });
    }
  });
  return result;
}

export function validateStyleKitContract(input: unknown): ModelTypeStyleKitContract {
  const issues: StyleKitValidationIssue[] = [];
  if (!isRecord(input)) throw new StyleKitContractError([{ path: "styleKit", message: "must be an object" }]);

  const contractVersion = readString(input, "contractVersion", "styleKit", issues);
  if (contractVersion && contractVersion !== STYLE_KIT_CONTRACT_VERSION) {
    issues.push({ path: "styleKit.contractVersion", message: `must equal '${STYLE_KIT_CONTRACT_VERSION}'` });
  }
  const id = readString(input, "id", "styleKit", issues);
  const version = readString(input, "version", "styleKit", issues);
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
    issues.push({ path: "styleKit.version", message: "must use semantic version format x.y.z" });
  }
  const modelTypeId = readString(input, "modelTypeId", "styleKit", issues);
  const rigId = readString(input, "rigId", "styleKit", issues);

  const slots: StyleKitSlotDeclaration[] = [];
  const slotIds = new Set<string>();
  if (!Array.isArray(input.slots) || input.slots.length === 0) {
    issues.push({ path: "styleKit.slots", message: "must be a non-empty array" });
  } else {
    input.slots.forEach((candidate, index) => {
      const path = `styleKit.slots[${index}]`;
      if (!isRecord(candidate)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      const slotId = readString(candidate, "id", path, issues);
      if (slotIds.has(slotId)) issues.push({ path: `${path}.id`, message: `duplicate slot '${slotId}'` });
      slotIds.add(slotId);
      const kind = candidate.kind;
      if (kind !== "structural" && kind !== "presentation") {
        issues.push({ path: `${path}.kind`, message: "must be structural or presentation" });
      }
      const deformationRole = candidate.deformationRole;
      if (deformationRole !== "rigid" && deformationRole !== "skinned" && deformationRole !== "presentation") {
        issues.push({ path: `${path}.deformationRole`, message: "must be rigid, skinned, or presentation" });
      }
      const parentPartId = candidate.parentPartId === null
        ? null
        : nonEmptyString(candidate.parentPartId)
          ? candidate.parentPartId
          : (issues.push({ path: `${path}.parentPartId`, message: "must be a non-empty string or null" }), null);
      const variants: StyleKitVariantDeclaration[] = [];
      const variantIds = new Set<string>();
      if (!Array.isArray(candidate.variants) || candidate.variants.length === 0) {
        issues.push({ path: `${path}.variants`, message: "must be a non-empty array" });
      } else {
        candidate.variants.forEach((variantCandidate, variantIndex) => {
          const variantPath = `${path}.variants[${variantIndex}]`;
          if (!isRecord(variantCandidate)) {
            issues.push({ path: variantPath, message: "must be an object" });
            return;
          }
          const variantId = readString(variantCandidate, "id", variantPath, issues);
          if (variantIds.has(variantId)) issues.push({ path: `${variantPath}.id`, message: `duplicate variant '${variantId}'` });
          variantIds.add(variantId);
          const compatibleRigIds = validateStringArray(variantCandidate.compatibleRigIds, `${variantPath}.compatibleRigIds`, issues);
          if (rigId && !compatibleRigIds.includes(rigId)) {
            issues.push({ path: `${variantPath}.compatibleRigIds`, message: `must include style-kit rig '${rigId}'` });
          }
          variants.push({
            id: variantId,
            label: readString(variantCandidate, "label", variantPath, issues),
            sourceId: readString(variantCandidate, "sourceId", variantPath, issues),
            compatibleRigIds,
            materialSlots: validateStringArray(variantCandidate.materialSlots, `${variantPath}.materialSlots`, issues, false),
          });
        });
      }
      slots.push({
        id: slotId,
        label: readString(candidate, "label", path, issues),
        required: typeof candidate.required === "boolean"
          ? candidate.required
          : (issues.push({ path: `${path}.required`, message: "must be a boolean" }), false),
        kind: kind === "presentation" ? "presentation" : "structural",
        parentPartId,
        anchorId: readString(candidate, "anchorId", path, issues),
        deformationRole: deformationRole === "skinned" || deformationRole === "presentation" ? deformationRole : "rigid",
        variants,
      });
    });
  }

  const controls: StyleKitControlDeclaration[] = [];
  const controlIds = new Set<string>();
  if (!Array.isArray(input.controls) || input.controls.length === 0) {
    issues.push({ path: "styleKit.controls", message: "must be a non-empty array" });
  } else {
    input.controls.forEach((candidate, index) => {
      const path = `styleKit.controls[${index}]`;
      if (!isRecord(candidate)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      const controlId = readString(candidate, "id", path, issues);
      if (controlIds.has(controlId)) issues.push({ path: `${path}.id`, message: `duplicate control '${controlId}'` });
      controlIds.add(controlId);
      const min = candidate.min;
      const max = candidate.max;
      const defaultValue = candidate.default;
      if (!finiteNumber(min)) issues.push({ path: `${path}.min`, message: "must be a finite number" });
      if (!finiteNumber(max)) issues.push({ path: `${path}.max`, message: "must be a finite number" });
      if (!finiteNumber(defaultValue)) issues.push({ path: `${path}.default`, message: "must be a finite number" });
      if (finiteNumber(min) && finiteNumber(max) && min > max) issues.push({ path, message: "min must be less than or equal to max" });
      if (finiteNumber(defaultValue) && finiteNumber(min) && finiteNumber(max) && (defaultValue < min || defaultValue > max)) {
        issues.push({ path: `${path}.default`, message: "must fall within min and max" });
      }
      const affectedSlotIds = validateStringArray(candidate.affectedSlotIds, `${path}.affectedSlotIds`, issues);
      affectedSlotIds.forEach((slotId) => {
        if (!slotIds.has(slotId)) issues.push({ path: `${path}.affectedSlotIds`, message: `references unknown slot '${slotId}'` });
      });
      controls.push({
        id: controlId,
        label: readString(candidate, "label", path, issues),
        implementationKey: readString(candidate, "implementationKey", path, issues),
        min: finiteNumber(min) ? min : 0,
        max: finiteNumber(max) ? max : 0,
        default: finiteNumber(defaultValue) ? defaultValue : 0,
        affectedSlotIds,
        affectedAnchorIds: validateStringArray(candidate.affectedAnchorIds, `${path}.affectedAnchorIds`, issues),
      });
    });
  }

  const presets: StyleKitPresetDeclaration[] = [];
  const presetIds = new Set<string>();
  if (!Array.isArray(input.presets) || input.presets.length === 0) {
    issues.push({ path: "styleKit.presets", message: "must be a non-empty array" });
  } else {
    input.presets.forEach((candidate, index) => {
      const path = `styleKit.presets[${index}]`;
      if (!isRecord(candidate)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      const presetId = readString(candidate, "id", path, issues);
      if (presetIds.has(presetId)) issues.push({ path: `${path}.id`, message: `duplicate preset '${presetId}'` });
      presetIds.add(presetId);
      presets.push({
        id: presetId,
        label: readString(candidate, "label", path, issues),
        selections: validateCompleteSelections(candidate.selections, slots, `${path}.selections`, issues),
        parameters: validateCompleteParameters(candidate.parameters, controls, `${path}.parameters`, issues),
      });
    });
  }

  const defaultPresetId = readString(input, "defaultPresetId", "styleKit", issues);
  if (defaultPresetId && !presetIds.has(defaultPresetId)) {
    issues.push({ path: "styleKit.defaultPresetId", message: `unknown preset '${defaultPresetId}'` });
  }

  if (issues.length > 0) throw new StyleKitContractError(issues);
  return Object.freeze({
    contractVersion: STYLE_KIT_CONTRACT_VERSION,
    id,
    version,
    modelTypeId,
    rigId,
    slots,
    controls,
    presets,
    defaultPresetId,
  });
}

export function validateStyleConfiguration(
  styleKit: ModelTypeStyleKitContract,
  input: unknown,
): CharacterStyleConfiguration {
  const issues: StyleKitValidationIssue[] = [];
  if (!isRecord(input)) throw new StyleConfigurationError([{ path: "styleConfiguration", message: "must be an object" }]);
  if (input.schema !== STYLE_CONFIGURATION_SCHEMA) {
    issues.push({ path: "styleConfiguration.schema", message: `must equal '${STYLE_CONFIGURATION_SCHEMA}'` });
  }
  if (input.styleKitId !== styleKit.id) {
    issues.push({ path: "styleConfiguration.styleKitId", message: `must equal '${styleKit.id}'` });
  }
  if (input.styleKitVersion !== styleKit.version) {
    issues.push({ path: "styleConfiguration.styleKitVersion", message: `must equal '${styleKit.version}'` });
  }
  if (input.modelTypeId !== styleKit.modelTypeId) {
    issues.push({ path: "styleConfiguration.modelTypeId", message: `must equal '${styleKit.modelTypeId}'` });
  }
  const source = input.source;
  if (source !== "preset" && source !== "reference-analysis" && source !== "user") {
    issues.push({ path: "styleConfiguration.source", message: "must be preset, reference-analysis, or user" });
  }
  const selections = validateCompleteSelections(input.selections, styleKit.slots, "styleConfiguration.selections", issues);
  const parameters = validateCompleteParameters(input.parameters, styleKit.controls, "styleConfiguration.parameters", issues);
  if (issues.length > 0) throw new StyleConfigurationError(issues);
  return Object.freeze({
    schema: STYLE_CONFIGURATION_SCHEMA,
    styleKitId: styleKit.id,
    styleKitVersion: styleKit.version,
    modelTypeId: styleKit.modelTypeId,
    source: source as StyleConfigurationSource,
    selections,
    parameters,
  });
}

export function styleConfigurationFromPreset(
  styleKit: ModelTypeStyleKitContract,
  presetId = styleKit.defaultPresetId,
): CharacterStyleConfiguration {
  const preset = styleKit.presets.find((candidate) => candidate.id === presetId);
  if (!preset) {
    throw new StyleConfigurationError([{ path: "presetId", message: `unknown preset '${presetId}'` }]);
  }
  return validateStyleConfiguration(styleKit, {
    schema: STYLE_CONFIGURATION_SCHEMA,
    styleKitId: styleKit.id,
    styleKitVersion: styleKit.version,
    modelTypeId: styleKit.modelTypeId,
    source: "preset",
    selections: preset.selections,
    parameters: preset.parameters,
  });
}
