// src/lib/itemTextureSlots.ts
//
// Ground-truth: validated against two real Steam-published item mods
//   SheepToiletRollHolder_1274330899679336871.mod
//   BucketyMcBucketFace_3607914147611081651.mod
//
// All texture slots are flat properties on the ItemMeshReference ComponentNode.
// They are NOT nested inside Surfaces — Surfaces is a separate typed sub-array.

import type { ComponentNode } from '../types/types'

// ─── Slot names ──────────────────────────────────────────────────────────────

// Named per-mesh texture slots on ItemMeshReference, as they appear verbatim
// in the .prefab file and in ComponentNode.properties.
//
// Confirmed bound in real mods: DetailMap, ColorZoneMap
// Editor-exposed but not yet seen in validated samples: DecalMap, DirtyOverlay
export const ITEM_MESH_TEXTURE_SLOTS = [
  'DetailMap',
  'ColorZoneMap',
  'DecalMap',
  'DirtyOverlay',
] as const

export type ItemMeshTextureSlot = (typeof ITEM_MESH_TEXTURE_SLOTS)[number]

// Human-readable labels for the upload UI.
// Keep these slot-name-agnostic — we don't yet have confirmed semantics
// for every slot (e.g. exactly what ColorZoneMap does vs DetailMap for a
// given item). Labels describe the slot, not a PBR workflow concept.
export const SLOT_LABELS: Record<ItemMeshTextureSlot, string> = {
  DetailMap:    'Detail Map',
  ColorZoneMap: 'Color Zone Map',
  DecalMap:     'Decal Map',
  DirtyOverlay: 'Dirty Overlay',
}

// Slots confirmed to bind real textures in validated mods
export const CONFIRMED_SLOTS = new Set<ItemMeshTextureSlot>(['DetailMap', 'ColorZoneMap'])

// ─── Constants ───────────────────────────────────────────────────────────────

// The Surface.Value used by every non-recolorable item node in both validated mods.
// Non-recolorable items always point at this base-game surface — they do not fork
// a mod-owned Surfaces.setting entry.
export const BASE_GAME_DETAIL_SURFACE_GUID = '6384339467092412900'

// Game version string to embed in .png.meta sidecars.
// Observed value across both validated item mods.
export const ITEM_META_GAME_VERSION = '20057'

// ─── Asset cache key ─────────────────────────────────────────────────────────

// Stable key for persisting an uploaded texture in assetDb.
// Format: item_tex_{itemGuid}_{slotName}
// Hydrated on boot by getAllFiles() — same path as thumbnail keys.
export function itemTextureCacheKey(itemGuid: string, slot: ItemMeshTextureSlot): string {
  return `item_tex_${itemGuid}_${slot}`
}

// ─── .png.meta emitter ───────────────────────────────────────────────────────

// Emits the bare 4-line Type:2 sidecar for an item texture asset.
//
// CRITICAL: Do NOT add IsLinear or IsPointFilter here.
// Those flags are surface-mod-only (Surfaces.setting-backed textures).
// Item texture .meta files carry no color-space flags — confirmed across
// all 10 texture sidecars in the two validated mods, including normal maps.
//
// ImportFileCheckSum is a Unity import hash, not a file digest.
// It cannot be reproduced offline (sha1 of file bytes does NOT match).
// Pass an empty string — the game backfills it on first load.
export function emitItemTextureMeta(assetGuid: string, checksum = ''): string {
  return [
    `GUID:${assetGuid}`,
    `Type:2`,
    `UpdatedToGameVersion:${ITEM_META_GAME_VERSION}`,
    `ImportFileCheckSum:${checksum}`,
  ].join('\n') + '\n'
}

// ─── Slot read/write helpers ──────────────────────────────────────────────────

// Read the current texture GUID bound to a slot on an ItemMeshReference node.
// Returns null if the slot is not set.
export function getTextureSlot(
  node: ComponentNode,
  slot: ItemMeshTextureSlot
): string | null {
  const val = node.properties[slot]
  return typeof val === 'string' && val.length > 0 ? val : null
}

// Return a new ComponentNode with the slot set (guid provided) or cleared (null).
// Pure — does not mutate the input node.
// The caller is responsible for updating the item's components array in the store.
export function bindTextureSlot(
  node: ComponentNode,
  slot: ItemMeshTextureSlot,
  guid: string | null
): ComponentNode {
  const properties = { ...node.properties }
  if (guid !== null) {
    properties[slot] = guid
  } else {
    delete properties[slot]
  }
  return { ...node, properties }
}

// ─── Node filtering ───────────────────────────────────────────────────────────

// Returns only the ItemMeshReference nodes from a component array,
// in document order (root first, then children by ChildIndex).
// These are the only nodes that carry texture slot bindings.
export function getMeshNodes(components: ComponentNode[]): ComponentNode[] {
  return components.filter(c => c.type === 'ItemMeshReference')
}