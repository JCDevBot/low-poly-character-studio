export const CHARACTER_CAPABILITY_CONTRACT_VERSION = "character-capability-contract/v1" as const;

export const BASELINE_CHARACTER_ACTIONS = [
  "neutral",
  "idle",
  "walk",
  "run",
  "crouch",
  "kneel",
  "sit",
  "jump",
  "climb",
  "fall",
  "death",
  "crawl",
  "manipulate-object",
] as const;

export type SemanticActionId = (typeof BASELINE_CHARACTER_ACTIONS)[number];

export const FUNCTIONAL_PART_ROLES = [
  "core",
  "locomotor",
  "support-contact",
  "manipulator",
  "grasper",
  "sensor",
  "articulator",
  "presentation",
] as const;

export type FunctionalPartRole = (typeof FUNCTIONAL_PART_ROLES)[number];

export interface ModelTypeSemanticActionDeclaration {
  id: SemanticActionId;
  required: boolean;
  implementationId: string | null;
}

export interface ModelTypeCharacterCapabilityContract {
  contractVersion: typeof CHARACTER_CAPABILITY_CONTRACT_VERSION;
  semanticActions: readonly ModelTypeSemanticActionDeclaration[];
}

export function defineBaselineCharacterActions(
  implementations: Partial<Record<SemanticActionId, string>> = {},
): readonly ModelTypeSemanticActionDeclaration[] {
  return BASELINE_CHARACTER_ACTIONS.map((id) => ({
    id,
    required: true,
    implementationId: implementations[id] ?? null,
  }));
}
