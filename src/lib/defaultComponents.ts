// src/lib/defaultComponents.ts
//
// Factory for the default ComponentNode[] scaffold used when creating a new
// item mod from scratch in the Studio (wizard flow).
//
// Produces a single-node prefab with the three components every Paralives item
// requires: ItemObjectRoot, ItemCubeTransform, ItemMeshReference.
//
// Values are taken from the two validated real mods (BucketyMcBucketFace and
// SheepToiletRollHolder) — these are the minimal correct defaults that produce
// a game-loadable item. All values can be edited in the Prefab tab afterwards.
//
// GUIDs generated here are stable per-call (crypto.randomUUID()) — they are
// NOT persisted until the item is saved to the store, so re-running the factory
// produces fresh GUIDs each time. That's correct: the factory is only called
// once per wizard completion.

import type { ComponentNode } from '../types/types'
import {
  BASE_GAME_DETAIL_SURFACE_GUID,
  ITEM_MESH_TEXTURE_SLOTS,
} from './itemTextureSlots'
import type { ItemMeshTextureSlot } from './itemTextureSlots'

// Stable numeric-style GUID from a crypto UUID — strips hyphens and
// non-digit characters, pads to 19 digits. Used for surface-slot GUIDs
// that need to look like real Paralives GUIDs.
function makeNumericGuid(): string {
  return crypto.randomUUID()
    .replace(/-/g, '')
    .replace(/[a-f]/g, (c) => String(c.charCodeAt(0) - 87))  // a→10, b→11, etc → single digit
    .replace(/[^0-9]/g, '1')
    .substring(0, 19)
    .padEnd(19, '0')
}

/**
 * Build the default ComponentNode[] for a freshly created single-mesh item.
 *
 * @param nodeGuid    - The ItemObject GUID for the root node (also used as
 *                      the ItemMeshReferences registry key). Should match
 *                      item.guid so the node is stable across imports.
 * @param assetGuid   - The FBX asset GUID (from assetDb key `mesh_{assetGuid}`).
 *                      Written into the ItemMeshReferences registry on
 *                      ItemObjectRoot and as AssetMesh on ItemMeshReference.
 *                      Pass null if no mesh was uploaded yet.
 * @param textureGuids - Map of slot → asset GUID for each uploaded texture.
 *                      Only slots present in this map get a property on
 *                      ItemMeshReference. Pass {} if no textures were uploaded.
 */
export function makeDefaultComponents(
  nodeGuid: string,
  assetGuid: string | null,
  textureGuids: Partial<Record<ItemMeshTextureSlot, string>> = {},
): ComponentNode[] {
  const surfaceSlotGuid = makeNumericGuid()

  // ── ItemObjectRoot ──────────────────────────────────────────────────────────
  const itemObjectRoot: ComponentNode = {
    id: nodeGuid,
    type: 'ItemObjectRoot',
    nodeName: 'Root',
    childIndex: undefined,
    surfaces: undefined,
    properties: {
      ItemCanBeStackedOn: 'True',
      ItemCanStackOnOther: 'True',
      // IsScalable with sub-properties — same shape as parsed from real mods
      IsScalable: {
        _value: 'True',
        ScalableAxes: 'bool3(True, True, True)',
        HasMinScale: 'True',
        MinScale: 0.0135,
        HasMaxScale: 'True',
        MaxScale: 10,
      },
      // ItemMeshReferences registry — null placeholder; prefabGenerator fills
      // this with the actual nodeGuid→assetGuid entries at serialisation time.
      // AssetMesh is stored directly on the ItemMeshReference component so
      // MeshViewport can find it without walking the root registry.
      ItemMeshReferences: null,
    },
  }

  // ── ItemCubeTransform ───────────────────────────────────────────────────────
  // Neutral defaults: unit cube, centered pivot, no rotation/offset.
  // The user will resize this after seeing the mesh in the viewport.
  const itemCubeTransform: ComponentNode = {
    id: nodeGuid,
    type: 'ItemCubeTransform',
    nodeName: 'Root',
    childIndex: undefined,
    surfaces: undefined,
    properties: {
      LocalScale: [1, 1, 1],
      Pivot:      [0.5, 0.5, 0.5],
      Size:       [1, 1, 1],
    },
  }

  // ── ItemMeshReference ───────────────────────────────────────────────────────
  const meshRefProperties: Record<string, unknown> = {}

  // AssetMesh — stored as raw string (no parseFloat) matching the registry
  if (assetGuid) {
    meshRefProperties['AssetMesh'] = assetGuid
  }

  // Texture slots — only include slots that have a bound GUID
  for (const slot of ITEM_MESH_TEXTURE_SLOTS) {
    const guid = textureGuids[slot]
    if (guid) meshRefProperties[slot] = guid
  }

  const itemMeshReference: ComponentNode = {
    id: nodeGuid,
    type: 'ItemMeshReference',
    nodeName: 'Root',
    childIndex: undefined,
    // Every item mesh needs at least one Surface entry pointing at the
    // base-game detail surface GUID (non-recolorable). The slot GUID is a
    // freshly generated numeric GUID that will be registered in
    // ItemMeshReference.setting on export.
    surfaces: [
      {
        guid:  surfaceSlotGuid,
        value: BASE_GAME_DETAIL_SURFACE_GUID,
      },
    ],
    properties: meshRefProperties as ComponentNode['properties'],
  }

  return [itemObjectRoot, itemCubeTransform, itemMeshReference]
}

/**
 * Derive a texture GUID map from the assetGuid → slot assignment used by
 * buildItem in CreateModWizard. The wizard assigns slots positionally
 * (first file → DetailMap, second → ColorZoneMap, etc.) but stores the files
 * in assetDb under item_tex_{itemGuid}_{slot} keys rather than by asset GUID.
 *
 * This helper takes the list of uploaded texture files (in wizard order) and
 * the corresponding asset GUIDs generated during file storage, and returns the
 * slot → assetGuid map expected by makeDefaultComponents.
 *
 * @param assetGuids - Array of asset GUIDs in the same order as the uploaded
 *                     texture files (index 0 → DetailMap, 1 → ColorZoneMap, …)
 */
export function makeTextureGuidMap(
  assetGuids: string[],
): Partial<Record<ItemMeshTextureSlot, string>> {
  const map: Partial<Record<ItemMeshTextureSlot, string>> = {}
  for (let i = 0; i < assetGuids.length; i++) {
    const slot = ITEM_MESH_TEXTURE_SLOTS[i]
    if (!slot) break
    map[slot] = assetGuids[i]
  }
  return map
}