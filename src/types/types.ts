// src/types/types.ts

export type ModType = 'item' | 'translation' | 'surface'

// A single Surface slot inside an ItemMeshReference node.
// Parsed from the nested Surfaces block in the .prefab file.
export interface ItemMeshSurface {
  guid: string   // surface-slot GUID (referenced in ItemMeshReference.setting)
  value: string  // surface asset GUID (6384339467092412900 for non-recolorable)
}

// A single component property value as parsed from a .prefab file. Flat scalars
// (string/number/null) and vectors (number[]) appear directly; a property with
// sub-properties (see ModImporter.tsx's parsePrefabGraph) is promoted to an object
// keyed by sub-property name, with the original scalar preserved under `_value`.
export type PrefabPropertyValue =
  | string
  | number
  | number[]
  | null
  | { [subKey: string]: PrefabPropertyValue | undefined }

// One node from the parsed prefab graph.
export interface ComponentNode {
  id: string           // ItemObject GUID from the prefab (stable across imports)
  type: string         // e.g. 'ItemObjectRoot', 'ItemCubeTransform', 'ItemMeshReference'
  nodeName?: string    // Name: field from the ItemObject block ('Root', 'Child', etc.)
  childIndex?: number  // ChildIndex: — undefined for root, 0/1/2 for children
  properties: Record<string, PrefabPropertyValue>
  surfaces?: ItemMeshSurface[]
}

export interface TranslationData {
  language: string
  strings: Record<string, string>
}

// ── Items.setting sub-structures ──────────────────────────────────────────────

// One entry in the Tag array. Value is a build-mode catalog tag GUID.
export interface ItemTag {
  guid: string   // entry GUID (throwaway, unique per tag slot)
  value: string  // the actual build-mode tag GUID (from BuildModeCatalogTags.setting)
}

// One entry in ColorZoneNames. Value is a translation GUID.
export interface ItemColorZoneName {
  guid: string
  value: string
}

// One entry in MeshParts. Ties a mesh sub-part to a display name.
export interface ItemMeshPart {
  guid: string
  displayName: string
}

// One entry in ItemVariants.
export interface ItemVariantEntry {
  guid: string           // entry GUID (throwaway)
  itemVariantGuid: string // GUID of the actual variant Item in AllItems
  useSurfaceThumbnailTexture?: boolean  // UseSurfaceThumbnailTexture: — confirmed in-game, raw key unconfirmed in a real sample
}

// ── Main Item type ─────────────────────────────────────────────────────────────

export interface Item {
  // ── Identity (Items.setting) ────────────────────────────────────────────────
  id: string           // app-internal UUID, not persisted to mod files
  guid: string         // Paralives GUID — appears in Items.setting and prefab refs
  name: string         // resolved display name (from Translations.setting lookup)
  description: string  // app-only field, not in Items.setting

  // DisplayName GUID from Items.setting — points to a Translations.setting entry.
  // Preserved from import so re-export can emit the exact same GUID rather than
  // generating a placeholder. Undefined for items created fresh in the Studio
  // (the generator will derive or create one in that case).
  displayNameGuid?: string

  // ── Catalog (Items.setting) ─────────────────────────────────────────────────
  prefabGuid: string            // Prefab: field — references Prefabs.Metacache
  hideFromCatalog: boolean      // HideFromCatalog:
  overrideInteractionGroup: boolean
  overrideImpostorInteractions: boolean

  // ── Tags (Items.setting → Tag array) ────────────────────────────────────────
  tags: ItemTag[]               // structured — was string[] before

  // ── Swatch (Items.setting) ──────────────────────────────────────────────────
  hasSwatches: boolean          // HasSwatches:
  swatchGroup: string           // SwatchGroup: (GUID)
  defaultSwatch: string         // DefaultSwatch: (GUID, '0' if unset)
  swatchColorZoneCount: number  // SwatchColorZoneCount: (0–3)
  swatchThumbnailType: number   // SwatchThumbnailType: (1=item, 3=floor, 4=wall)
  colorZoneNames: ItemColorZoneName[]

  // ── Placement (Items.setting) ────────────────────────────────────────────────
  price: number                   // PriceOverride:
  priceMultiplier: number         // PriceMultiplier:
  priceSkinProperty: string       // PriceSkinProperty: ('None' if unset)
  multipurchaseOverride: string   // MultipurchaseOverride: ('NoOverride' if unset)
  autoSelect: boolean             // AutoSelect:
  itemPlacementTweenOverride: string
  meshParts: ItemMeshPart[]
  ropeItems: string[]             // array of GUIDs

  // ── Snapping (Items.setting) ─────────────────────────────────────────────────
  overrideSnap: boolean
  rotateToSnapOverride: string    // ('NoOverride' if unset)

  // ── Rendering (Items.setting) ────────────────────────────────────────────────
  alwaysVisibleOnWalls: boolean
  renderAsWall: boolean
  overrideItemFadingFromCamera: boolean
  cannotBatch: boolean

  // ── Animation (Items.setting) ────────────────────────────────────────────────
  overrideItemForAnimation: string  // ('None' if unset)

  // ── Bills (Items.setting) ────────────────────────────────────────────────────
  ignoreUsageLevelFromTags: boolean

  // ── Dirtyness / Brokenness (Items.setting) ───────────────────────────────────
  dirtinessSpeedTier: string   // ('None' if unset)
  breakingSpeedTier: string    // ('None' if unset)

  // ── Variants in UI (Items.setting) ───────────────────────────────────────────
  itemVariants: ItemVariantEntry[]
  variantGuids?: string[]               // derived: flat list of itemVariantGuid values, for accordion grouping
  synchronizeSwatchAmongVariants: boolean
  ignoreRememberIndexForCategory: boolean
  hasSizeVariantsOverrides: boolean

  // ── Collectability / Patreon (Items.setting) ─────────────────────────────────
  collectibleCollection: string  // ('None' if unset)
  patreonName: string            // ('' if unset)

  // ── Nested Prefab (Items.setting) ────────────────────────────────────────────
  overrideNestedPrefabToSpawn: boolean

  // ── Snapping (Items.setting) ─────────────────────────────────────────────────
  resizeSnapProfiles: string[]  // array of GUIDs

  // ── Asset cache ──────────────────────────────────────────────────────────────
  thumbnailKey: string | null

  // meshKeys: maps FBX asset GUID → assetDb cache key for that FBX blob.
  // Populated on import from .fbx + .fbx.meta pairs in the mod zip.
  // Key format: mesh_{assetGuid}. Used by MeshViewport to load the right FBX.
  meshKeys: Record<string, string>

  // ── Legacy / compat ──────────────────────────────────────────────────────────
  // textureKeys: always {} — kept for backward compat with old persisted projects.
  // Slot-bound textures are read from components[].properties instead.
  textureKeys: Record<string, string>

  componentBlueprints: {
    rootDefaultStates: string[]
    materialSurfaces: string[]
  }

  // ── Prefab graph ─────────────────────────────────────────────────────────────
  components: ComponentNode[]
}

// ── Sensible defaults for a new/empty Item ────────────────────────────────────
export function makeDefaultItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(),
    guid: crypto.randomUUID(),
    name: 'New Custom Item',
    description: '',
    prefabGuid: '',
    hideFromCatalog: false,
    overrideInteractionGroup: false,
    overrideImpostorInteractions: false,
    tags: [],
    hasSwatches: false,
    swatchGroup: '',
    defaultSwatch: '0',
    swatchColorZoneCount: 0,
    swatchThumbnailType: 1,
    colorZoneNames: [],
    price: 5,
    priceMultiplier: 1,
    priceSkinProperty: 'None',
    multipurchaseOverride: 'NoOverride',
    autoSelect: false,
    itemPlacementTweenOverride: 'None',
    meshParts: [],
    ropeItems: [],
    overrideSnap: false,
    rotateToSnapOverride: 'NoOverride',
    alwaysVisibleOnWalls: false,
    renderAsWall: false,
    overrideItemFadingFromCamera: false,
    cannotBatch: false,
    overrideItemForAnimation: 'None',
    ignoreUsageLevelFromTags: false,
    dirtinessSpeedTier: 'None',
    breakingSpeedTier: 'None',
    itemVariants: [],
    variantGuids: undefined,
    synchronizeSwatchAmongVariants: false,
    ignoreRememberIndexForCategory: false,
    hasSizeVariantsOverrides: false,
    collectibleCollection: 'None',
    patreonName: '',
    overrideNestedPrefabToSpawn: false,
    resizeSnapProfiles: [],
    thumbnailKey: null,
    meshKeys: {},
    textureKeys: {},
    componentBlueprints: { rootDefaultStates: [], materialSurfaces: [] },
    components: [],
    ...overrides,
  }
}

export interface ModProject {
  id: string
  modType: ModType
  modGuid?: string
  name: string
  description: string
  version: string
  author: string
  coverThumbnailKey: string | null
  items: Item[]
  assets: unknown[]  // reserved for future use — never populated with real data yet
  translations?: TranslationData[]
  workshopTags: string[]  // Steam Workshop publishing tags — see data/workshopTags.ts
  createdAt: string
  updatedAt: string
}