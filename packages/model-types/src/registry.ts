import { humanoidChibiV1Manifest } from "./manifests/humanoid-chibi-v1";
import { ModelTypeManifestError, validateModelTypeManifest } from "./schema";
import type { ModelTypeManifest } from "./types";

export class ModelTypeRegistry {
  readonly #byId: ReadonlyMap<string, ModelTypeManifest>;

  constructor(manifests: readonly unknown[]) {
    const byId = new Map<string, ModelTypeManifest>();
    for (const candidate of manifests) {
      const manifest = validateModelTypeManifest(candidate);
      if (byId.has(manifest.id)) {
        throw new ModelTypeManifestError([
          { path: "registry", message: `duplicate model type id '${manifest.id}'` },
        ]);
      }
      byId.set(manifest.id, manifest);
    }
    this.#byId = byId;
  }

  list(): readonly ModelTypeManifest[] {
    return Object.freeze([...this.#byId.values()]);
  }

  get(id: string): ModelTypeManifest | undefined {
    return this.#byId.get(id);
  }

  require(id: string): ModelTypeManifest {
    const manifest = this.get(id);
    if (!manifest) {
      throw new Error(`Unknown model type '${id}'. Available model types: ${[...this.#byId.keys()].join(", ") || "none"}`);
    }
    return manifest;
  }
}

export const modelTypeRegistry = new ModelTypeRegistry([humanoidChibiV1Manifest]);
