export { humanoidChibiV1Manifest } from "./manifests/humanoid-chibi-v1";
export { humanoidChibiStyleKitV1 } from "./style-kits/humanoid-chibi-v1";
export { ModelTypeRegistry, modelTypeRegistry } from "./registry";
export {
  BASELINE_CHARACTER_ACTIONS,
  CHARACTER_CAPABILITY_CONTRACT_VERSION,
  FUNCTIONAL_PART_ROLES,
  defineBaselineCharacterActions,
  type FunctionalPartRole,
  type ModelTypeCharacterCapabilityContract,
  type ModelTypeSemanticActionDeclaration,
  type SemanticActionId,
} from "./capability-contracts";
export {
  STYLE_CONFIGURATION_SCHEMA,
  STYLE_KIT_CONTRACT_VERSION,
  StyleConfigurationError,
  StyleKitContractError,
  styleConfigurationFromPreset,
  validateStyleConfiguration,
  validateStyleKitContract,
  type CharacterStyleConfiguration,
  type ModelTypeStyleKitContract,
  type StyleConfigurationSource,
  type StyleKitControlDeclaration,
  type StyleKitDeformationRole,
  type StyleKitPresetDeclaration,
  type StyleKitSlotDeclaration,
  type StyleKitSlotKind,
  type StyleKitValidationIssue,
  type StyleKitVariantDeclaration,
} from "./style-kit-contracts";
export {
  ModelTypeManifestError,
  validateModelTypeManifest,
  type ManifestValidationIssue,
} from "./schema";
export type {
  ModelTypeCapabilities,
  ModelTypeExpectedPart,
  ModelTypeGoldStandard,
  ModelTypeManifest,
  ModelTypeReferenceSlot,
  NumericRange,
  OutputFormat,
  ReferenceSlotId,
} from "./types";
