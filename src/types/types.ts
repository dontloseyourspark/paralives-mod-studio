// src/types/types.ts

export type ModType = 'item' | 'translation' | 'surface'

// A single Surface slot inside an ItemMeshReference node.
// Parsed from the nested Surfaces block in the .prefab file.
// guid  — the surface-slot GUID (referenced in ItemMeshReference.setting)
// value — the surface asset GUID (6384339467092412900 for non-recolorable base-game surface)
export interface ItemMeshSurface {
  guid: string
  value: string
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
// For item mods, every ItemMeshReference node gets:
//   id         — the ItemObject GUID from the prefab (stable across imports)
//   type       — the component heading string, e.g. 'ItemMeshReference', 'ItemObjectRoot'
//   nodeName   — the Name: field from the ItemObject block ('Root', 'Child', etc.)
//   childIndex — the ChildIndex: field (0, 1, 2…) for child nodes; undefined for root
//   properties — flat key/value properties directly on the component
//                (DetailMap, ColorZoneMap, MeshIndex, LocalPosition, etc.)
//   surfaces   — parsed Surfaces block; each entry is one material slot
export interface ComponentNode {
  id: string
  type: string
  nodeName?: string
  childIndex?: number
  properties: Record<string, PrefabPropertyValue>
  surfaces?: ItemMeshSurface[]
}

export interface TranslationData {
  language: string
  strings: Record<string, string>
}

export interface Item {
  id: string
  guid: string
  name: string
  description: string
  price: number
  tags: string[]
  thumbnailKey: string | null
  // variantGuids: GUIDs of other items that are variants of this one (from ItemVariants block).
  // The parent item lists all variant GUIDs including itself. Used by ItemsPanel for accordion grouping.
  variantGuids?: string[]
  // textureKeys: legacy bag — no longer pre-populated from filenames on import.
  // Kept for backward compatibility with any existing persisted projects.
  // Slot-bound textures are read from components[].properties instead.
  textureKeys: Record<string, string>
  componentBlueprints: {
    rootDefaultStates: string[]
    materialSurfaces: string[]
  }
  components: ComponentNode[]
}

export interface ModProject {
  id: string
  modType: ModType           // Determines which editor view loads
  modGuid?: string           // Paralives ModGUID from _mod.meta — stable across export/re-import
  name: string
  description: string
  version: string
  author: string
  coverThumbnailKey: string | null
  items: Item[]
  assets: unknown[]  // reserved for future use — never populated with real data yet
  translations?: TranslationData[]
  createdAt: string
  updatedAt: string
}