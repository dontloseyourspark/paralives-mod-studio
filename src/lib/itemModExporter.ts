// src/lib/itemModExporter.ts
//
// Two export paths:
//
// 1. PATCH-AND-REPACK (imported mods):
//    Loads the original archive saved at import time under
//    `original_zip_{project.id}`, replaces only `Items.setting` with the
//    user's edits, swaps in the workshop thumbnail, and re-downloads.
//    Everything else (prefabs, textures, Metacache, etc.) is byte-for-byte
//    from the original. This is the fast, safe path for mods that were
//    imported into the Studio.
//
// 2. GENERATE-FROM-SCRATCH (Studio-created mods):
//    Builds the full mod folder from scratch using:
//      - generatePrefab()           → Prefabs/{name}.prefab
//      - generateItemsSetting()     → Settings/Items.setting
//      - generateItemTranslationsSetting() → Settings/Translations.setting
//      - generateModMeta()          → {name}_{modGuid}.mod.meta
//      - generatePrefabMeta()       → Prefabs/{name}.prefab.meta
//      - generateSettingMeta()      → Settings/*.setting.meta (×4)
//      - generatePrefabsMetacache() → _Metacache/Prefabs.Metacache
//      - generateDotMetacache()     → _Metacache/.Metacache
//      - generateSettingsMetacache()→ _Metacache/Settings.Metacache
//      - minimal stub generators    → Settings/ItemMeshReference.setting
//                                     Settings/ItemObjectRoot.setting
//      - FBX + PNG binaries from assetDb
//      - bare Type:1/.png.meta sidecars via emitItemTextureMeta()
//
// Known gaps (patch path):
//   - DisplayName (translation GUID) not patched — no name editor yet.
//   - Tag / ColorZoneNames / MeshParts / ItemVariants arrays not patched.
//   - Prefab-level edits (Prefab/Textures tabs) not reflected — .prefab
//     is untouched in patch path. These ARE written in generate-from-scratch.

import JSZip from 'jszip'
import { assetDb } from '../utils/assetDb'
import type { Item, ModProject } from '../types/types'
import { generateItemsSetting, generateItemTranslationsSetting } from './itemModGenerator'
import { generateModMeta, deriveModGuid } from './itemModMetaGenerator'
import {
  generatePrefab,
  generatePrefabMeta,
  generateSettingMeta,
  generatePrefabsMetacache,
  generateDotMetacache,
  generateSettingsMetacache,
} from './prefabGenerator'
import { ITEM_MESH_TEXTURE_SLOTS, itemTextureCacheKey, emitItemTextureMeta } from './itemTextureSlots'
import { getMeshNodes } from './itemTextureSlots'

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** Derive a safe ASCII folder/filename stem from the mod name. */
function modStem(project: ModProject): string {
  return project.name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_') || 'Mod'
}

/** Generate a stable Paralives-style numeric GUID from any string seed. */
function stableNumericGuid(seed: string): string {
  // Strip non-digits, pad/truncate to 19 chars
  const digits = seed.replace(/[^0-9]/g, '')
  return digits.substring(0, 19).padEnd(19, '1')
}

// ── PATCHABLE_FIELDS (patch path only) ───────────────────────────────────────

const PATCHABLE_FIELDS: { key: string; get: (item: Item) => string }[] = [
  { key: 'HideFromCatalog',              get: (i) => (i.hideFromCatalog              ? 'True' : 'False') },
  { key: 'OverrideInteractionGroup',     get: (i) => (i.overrideInteractionGroup     ? 'True' : 'False') },
  { key: 'OverrideImpostorInteractions', get: (i) => (i.overrideImpostorInteractions ? 'True' : 'False') },
  { key: 'HasSwatches',                  get: (i) => (i.hasSwatches                  ? 'True' : 'False') },
  { key: 'SwatchGroup',                  get: (i) => i.swatchGroup },
  { key: 'DefaultSwatch',               get: (i) => i.defaultSwatch },
  { key: 'SwatchColorZoneCount',        get: (i) => String(i.swatchColorZoneCount) },
  { key: 'SwatchThumbnailType',         get: (i) => String(i.swatchThumbnailType) },
  { key: 'PriceOverride',               get: (i) => String(i.price) },
  { key: 'PriceMultiplier',             get: (i) => String(i.priceMultiplier) },
  { key: 'PriceSkinProperty',           get: (i) => i.priceSkinProperty },
  { key: 'MultipurchaseOverride',       get: (i) => i.multipurchaseOverride },
  { key: 'AutoSelect',                  get: (i) => (i.autoSelect                   ? 'True' : 'False') },
  { key: 'ItemPlacementTweenOverride',  get: (i) => i.itemPlacementTweenOverride },
  { key: 'OverrideSnap',               get: (i) => (i.overrideSnap                  ? 'True' : 'False') },
  { key: 'RotateToSnapOverride',        get: (i) => i.rotateToSnapOverride },
  { key: 'AlwaysVisibleOnWalls',        get: (i) => (i.alwaysVisibleOnWalls         ? 'True' : 'False') },
  { key: 'RenderAsWall',               get: (i) => (i.renderAsWall                  ? 'True' : 'False') },
  { key: 'OverrideItemFadingFromCamera',get: (i) => (i.overrideItemFadingFromCamera  ? 'True' : 'False') },
  { key: 'CannotBatch',                get: (i) => (i.cannotBatch                   ? 'True' : 'False') },
  { key: 'OverrideItemForAnimation',   get: (i) => i.overrideItemForAnimation },
  { key: 'IgnoreUsageLevelFromTags',   get: (i) => (i.ignoreUsageLevelFromTags      ? 'True' : 'False') },
  { key: 'DirtinessSpeedTier',         get: (i) => i.dirtinessSpeedTier },
  { key: 'BreakingSpeedTier',          get: (i) => i.breakingSpeedTier },
  { key: 'SynchronizeSwatchAmongVariants',  get: (i) => (i.synchronizeSwatchAmongVariants  ? 'True' : 'False') },
  { key: 'IgnoreRememberIndexForCategory', get: (i) => (i.ignoreRememberIndexForCategory ? 'True' : 'False') },
  { key: 'HasSizeVariantsOverrides',   get: (i) => (i.hasSizeVariantsOverrides      ? 'True' : 'False') },
  { key: 'CollectibleCollection',      get: (i) => i.collectibleCollection },
  { key: 'PatreonName',               get: (i) => i.patreonName },
]

// ── Patch path ────────────────────────────────────────────────────────────────

export function patchItemsSetting(originalText: string, items: Item[]): string {
  const itemsByGuid = new Map(items.map((i) => [i.guid, i]))
  const usesCRLF = originalText.includes('\r\n')
  const lines = originalText.split(/\r\n|\n/)

  let currentItem: Item | null = null

  const patched = lines.map((rawLine) => {
    const line = rawLine.trim()
    const indent = rawLine.length - rawLine.trimStart().length

    if (indent === 2 && line.startsWith('@')) {
      currentItem = itemsByGuid.get(line.substring(1).trim()) ?? null
      return rawLine
    }

    if (currentItem && indent === 3 && line.startsWith('=')) {
      const sep = line.indexOf(':')
      if (sep !== -1) {
        const key = line.substring(1, sep).trim()
        const field = PATCHABLE_FIELDS.find((f) => f.key === key)
        if (field) {
          const leadingWhitespace = rawLine.slice(0, indent)
          return `${leadingWhitespace}=${key}:${field.get(currentItem!)}`
        }
      }
    }

    return rawLine
  })

  return patched.join(usesCRLF ? '\r\n' : '\n')
}

// ── Generate-from-scratch path ────────────────────────────────────────────────

// Minimal stub for ItemMeshReference.setting — a flat surface-slot registry.
// In real mods this lists every surface slot GUID from every node's Surfaces block.
// We emit the parsed surfaces from all ItemMeshReference nodes.
function generateItemMeshReferenceSetting(items: Item[], modGuid: string): string {
  const CRLF = '\r\n'
  const lines: string[] = []
  lines.push(`#Setting.ItemMeshReference${CRLF}`)
  lines.push(` =AllItemMeshReferences${CRLF}`)

  for (const item of items) {
    const meshNodes = getMeshNodes(item.components)
    for (const node of meshNodes) {
      if (!node.surfaces || node.surfaces.length === 0) continue
      for (const surf of node.surfaces) {
        if (!surf.guid) continue
        lines.push(`  @${surf.guid}${CRLF}`)
        lines.push(`   =GUID:${surf.guid}${CRLF}`)
        lines.push(`   =CustomModGUID:${modGuid}${CRLF}`)
      }
    }
  }

  return lines.join('')
}

// Minimal stub for ItemObjectRoot.setting — lists default state GUIDs.
function generateItemObjectRootSetting(items: Item[], modGuid: string): string {
  const CRLF = '\r\n'
  const lines: string[] = []
  lines.push(`#Setting.ItemObjectRoot${CRLF}`)
  lines.push(` =AllItemObjectRoots${CRLF}`)

  for (const item of items) {
    const rootStates = item.componentBlueprints?.rootDefaultStates ?? []
    for (const guid of rootStates) {
      lines.push(`  @${guid}${CRLF}`)
      lines.push(`   =GUID:${guid}${CRLF}`)
      lines.push(`   =CustomModGUID:${modGuid}${CRLF}`)
    }
  }

  return lines.join('')
}

async function exportFromScratch(project: ModProject): Promise<string> {
  const modGuid = deriveModGuid(project)
  const stem = modStem(project)
  const folder = `${stem}_${modGuid}.mod`

  // Derive a stable prefab name and GUID for each item.
  // For imported items, item.prefabGuid is the original prefab GUID from the mod.
  // For fresh items, derive a numeric GUID from item.guid.
  const getPrefabName = (item: Item) =>
    item.name.replace(/[^a-zA-Z0-9_]/g, '') || 'Item'
  const getPrefabGuid = (item: Item) =>
    item.prefabGuid || stableNumericGuid(item.guid + '_prefab')

  // Derive stable GUIDs for .setting.meta sidecars
  const itemsSettingGuid    = stableNumericGuid(modGuid + '_items_setting')
  const translationsGuid    = stableNumericGuid(modGuid + '_translations')
  const meshRefSettingGuid  = stableNumericGuid(modGuid + '_meshref_setting')
  const rootSettingGuid     = stableNumericGuid(modGuid + '_root_setting')

  const zip = new JSZip()

  // ── .mod.meta manifest ─────────────────────────────────────────────────────
  zip.file(`${folder}/${stem}_${modGuid}.mod.meta`, generateModMeta(project, modGuid))

  // ── Workshop thumbnail ──────────────────────────────────────────────────────
  if (project.coverThumbnailKey) {
    const thumbBlob = await assetDb.getFile(project.coverThumbnailKey)
    if (thumbBlob) zip.file(`${folder}/${stem}_${modGuid}_mod.thumbnail`, thumbBlob)
  }

  // ── Prefabs + sidecars ─────────────────────────────────────────────────────
  for (const item of project.items) {
    if (!item.components || item.components.length === 0) continue
    const prefabName = getPrefabName(item)
    const prefabGuid = getPrefabGuid(item)
    zip.file(`${folder}/Prefabs/${prefabName}.prefab`, generatePrefab(item))
    zip.file(`${folder}/Prefabs/${prefabName}.prefab.meta`, generatePrefabMeta(prefabGuid))
  }

  // ── Settings/*.setting ─────────────────────────────────────────────────────
  zip.file(`${folder}/Settings/Items.setting`,
    generateItemsSetting(project.items, modGuid))
  zip.file(`${folder}/Settings/Items.setting.meta`,
    generateSettingMeta(itemsSettingGuid))

  zip.file(`${folder}/Settings/Translations.setting`,
    generateItemTranslationsSetting(project.items))
  zip.file(`${folder}/Settings/Translations.setting.meta`,
    generateSettingMeta(translationsGuid))

  zip.file(`${folder}/Settings/ItemMeshReference.setting`,
    generateItemMeshReferenceSetting(project.items, modGuid))
  zip.file(`${folder}/Settings/ItemMeshReference.setting.meta`,
    generateSettingMeta(meshRefSettingGuid))

  zip.file(`${folder}/Settings/ItemObjectRoot.setting`,
    generateItemObjectRootSetting(project.items, modGuid))
  zip.file(`${folder}/Settings/ItemObjectRoot.setting.meta`,
    generateSettingMeta(rootSettingGuid))

  // ── FBX assets + .fbx.meta sidecars ───────────────────────────────────────
  // Collect all unique mesh cache keys across all items
  const allMeshKeys = new Map<string, string>() // assetGuid → cacheKey
  for (const item of project.items) {
    for (const [assetGuid, cacheKey] of Object.entries(item.meshKeys ?? {})) {
      allMeshKeys.set(assetGuid, cacheKey)
    }
  }

  // We need original FBX filenames. They're not stored on Item — derive from
  // the original zip if available, otherwise use assetGuid as filename.
  for (const [assetGuid, cacheKey] of allMeshKeys.entries()) {
    const fbxBlob = await assetDb.getFile(cacheKey)
    if (!fbxBlob) continue
    const filename = cacheKey.replace('mesh_', '') + '.fbx'
    zip.file(`${folder}/${filename}`, fbxBlob)
    // Bare Type:1 sidecar — same 4-line form as .png.meta
    zip.file(`${folder}/${filename}.meta`, [
      `GUID:${assetGuid}`,
      `Type:1`,
      `UpdatedToGameVersion:20057`,
      `ImportFileCheckSum:`,
    ].join('\n') + '\n')
  }

  // ── PNG texture assets + .png.meta sidecars ────────────────────────────────
  // For each item × each slot, load from assetDb and emit with bare Type:2 sidecar.
  // We need to map back from item_tex cache key to the asset GUID stored in the
  // node property (e.g. node.properties.DetailMap).
  const writtenTextures = new Set<string>() // avoid duplicate files

  for (const item of project.items) {
    const meshNodes = getMeshNodes(item.components)
    for (const node of meshNodes) {
      for (const slot of ITEM_MESH_TEXTURE_SLOTS) {
        const assetGuidRaw = node.properties[slot]
        if (assetGuidRaw == null) continue
        const assetGuid = String(assetGuidRaw)
        if (writtenTextures.has(assetGuid)) continue

        const cacheKey = itemTextureCacheKey(item.guid, slot)
        const pngBlob = await assetDb.getFile(cacheKey)
        if (!pngBlob) continue

        const filename = assetGuid + '.png'
        zip.file(`${folder}/${filename}`, pngBlob)
        zip.file(`${folder}/${filename}.meta`, emitItemTextureMeta(assetGuid))
        writtenTextures.add(assetGuid)
      }
    }
  }

  // ── _Metacache ─────────────────────────────────────────────────────────────
  // .Metacache: lists all mod-owned binary assets (FBX + PNG)
  const assetEntries: { filename: string; guid: string; type: 1 | 2 }[] = []
  for (const [assetGuid] of allMeshKeys.entries()) {
    const filename = assetGuid + '.fbx'
    assetEntries.push({ filename, guid: assetGuid, type: 1 })
  }
  for (const assetGuid of writtenTextures) {
    assetEntries.push({ filename: assetGuid + '.png', guid: assetGuid, type: 2 })
  }

  if (assetEntries.length === 0) {
    // 3-byte UTF-8 BOM only — no assets
    zip.file(`${folder}/_Metacache/.Metacache`, new Uint8Array([0xEF, 0xBB, 0xBF]))
  } else {
    zip.file(`${folder}/_Metacache/.Metacache`, generateDotMetacache(assetEntries, modGuid))
  }

  // Prefabs.Metacache: one entry per item
  const prefabsMetacacheLines: string[] = []
  for (const item of project.items) {
    if (!item.components || item.components.length === 0) continue
    const prefabName = getPrefabName(item)
    const prefabGuid = getPrefabGuid(item)
    prefabsMetacacheLines.push(generatePrefabsMetacache(prefabName, prefabGuid, modGuid))
  }
  zip.file(`${folder}/_Metacache/Prefabs.Metacache`, prefabsMetacacheLines.join('\n'))

  // Settings.Metacache: lists all Settings files
  const settingsEntries = [
    { name: 'Items',             guid: itemsSettingGuid },
    { name: 'Translations',      guid: translationsGuid },
    { name: 'ItemMeshReference', guid: meshRefSettingGuid },
    { name: 'ItemObjectRoot',    guid: rootSettingGuid },
  ]
  zip.file(`${folder}/_Metacache/Settings.Metacache`,
    generateSettingsMetacache(settingsEntries, modGuid))

  // ── Download ───────────────────────────────────────────────────────────────
  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = `${stem}_${modGuid}.mod.zip`
  triggerDownload(blob, filename)
  return filename
}

// ── Public API ────────────────────────────────────────────────────────────────

// Returns the downloaded filename so the caller can surface it in the
// post-export install instructions (ExportResultModal).
export async function exportItemMod(project: ModProject): Promise<string> {
  const originalZipBlob = await assetDb.getFile(`original_zip_${project.id}`)

  if (originalZipBlob) {
    // ── Patch-and-repack path (imported mods) ──────────────────────────────
    const zip = await JSZip.loadAsync(originalZipBlob)
    const paths = Object.keys(zip.files).filter((p) => !p.includes('__MACOSX/'))

    const itemsSettingPath = paths.find((p) => p.endsWith('Items.setting'))
    if (itemsSettingPath) {
      const originalText = await zip.files[itemsSettingPath].async('string')
      zip.file(itemsSettingPath, patchItemsSetting(originalText, project.items))
    }

    if (project.coverThumbnailKey) {
      const thumbBlob = await assetDb.getFile(project.coverThumbnailKey)
      const thumbPath = paths.find((p) => p.endsWith('.mod.thumbnail'))
      if (thumbBlob && thumbPath) zip.file(thumbPath, thumbBlob)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const filename = `${project.name.replace(/\s+/g, '_')}.mod.zip`
    triggerDownload(blob, filename)
    return filename
  }

  // ── Generate-from-scratch path (Studio-created mods) ──────────────────────
  return exportFromScratch(project)
}