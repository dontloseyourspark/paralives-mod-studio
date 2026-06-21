// src/lib/itemModExporter.ts
//
// Exports an imported item mod by re-zipping the ORIGINAL archive (saved at
// import time under assetDb key `original_zip_${project.id}`, see
// ModImporter.tsx) with only the Items.setting fields the user actually
// edited in the Studio patched in — everything else (prefabs, textures,
// Metacache, Settings/*.setting, etc.) passes through byte-for-byte
// unchanged. This is deliberately not a full regenerate-from-scratch
// exporter (that would also need to rebuild prefabs/Metacache and doesn't
// exist yet for item mods).
//
// Known gaps:
//   - name/DisplayName isn't patched — it's resolved via a translation GUID,
//     not a literal Items.setting field, so there's no single line to write.
//   - Tag / ColorZoneNames / MeshParts / ItemVariants arrays aren't patched —
//     there's no editor for these yet, so nothing to patch back.
//   - Component/prefab-level property edits (the node "Prefab"/"Textures"
//     tabs) aren't reflected — those live in the .prefab file, not
//     Items.setting, which this exporter doesn't touch.
//   - Items added or deleted in the Studio aren't added/removed from the
//     exported Items.setting — only edits to items that existed in the
//     original import are patched in.

import JSZip from 'jszip'
import { assetDb } from '../utils/assetDb'
import type { Item, ModProject } from '../types/types'

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

// Maps an Items.setting flat field name to how to read its current value off
// an Item. Mirrors the read side in ModImporter.tsx's parseParalivesSetting —
// same field list, same 'True'/'False' boolean encoding.
const PATCHABLE_FIELDS: { key: string; get: (item: Item) => string }[] = [
  { key: 'HideFromCatalog', get: (i) => (i.hideFromCatalog ? 'True' : 'False') },
  { key: 'OverrideInteractionGroup', get: (i) => (i.overrideInteractionGroup ? 'True' : 'False') },
  { key: 'OverrideImpostorInteractions', get: (i) => (i.overrideImpostorInteractions ? 'True' : 'False') },
  { key: 'HasSwatches', get: (i) => (i.hasSwatches ? 'True' : 'False') },
  { key: 'SwatchGroup', get: (i) => i.swatchGroup },
  { key: 'DefaultSwatch', get: (i) => i.defaultSwatch },
  { key: 'SwatchColorZoneCount', get: (i) => String(i.swatchColorZoneCount) },
  { key: 'SwatchThumbnailType', get: (i) => String(i.swatchThumbnailType) },
  { key: 'PriceOverride', get: (i) => String(i.price) },
  { key: 'PriceMultiplier', get: (i) => String(i.priceMultiplier) },
  { key: 'PriceSkinProperty', get: (i) => i.priceSkinProperty },
  { key: 'MultipurchaseOverride', get: (i) => i.multipurchaseOverride },
  { key: 'AutoSelect', get: (i) => (i.autoSelect ? 'True' : 'False') },
  { key: 'ItemPlacementTweenOverride', get: (i) => i.itemPlacementTweenOverride },
  { key: 'OverrideSnap', get: (i) => (i.overrideSnap ? 'True' : 'False') },
  { key: 'RotateToSnapOverride', get: (i) => i.rotateToSnapOverride },
  { key: 'AlwaysVisibleOnWalls', get: (i) => (i.alwaysVisibleOnWalls ? 'True' : 'False') },
  { key: 'RenderAsWall', get: (i) => (i.renderAsWall ? 'True' : 'False') },
  { key: 'OverrideItemFadingFromCamera', get: (i) => (i.overrideItemFadingFromCamera ? 'True' : 'False') },
  { key: 'CannotBatch', get: (i) => (i.cannotBatch ? 'True' : 'False') },
  { key: 'OverrideItemForAnimation', get: (i) => i.overrideItemForAnimation },
  { key: 'IgnoreUsageLevelFromTags', get: (i) => (i.ignoreUsageLevelFromTags ? 'True' : 'False') },
  { key: 'DirtinessSpeedTier', get: (i) => i.dirtinessSpeedTier },
  { key: 'BreakingSpeedTier', get: (i) => i.breakingSpeedTier },
  { key: 'SynchronizeSwatchAmongVariants', get: (i) => (i.synchronizeSwatchAmongVariants ? 'True' : 'False') },
  { key: 'IgnoreRememberIndexForCategory', get: (i) => (i.ignoreRememberIndexForCategory ? 'True' : 'False') },
  { key: 'HasSizeVariantsOverrides', get: (i) => (i.hasSizeVariantsOverrides ? 'True' : 'False') },
  { key: 'CollectibleCollection', get: (i) => i.collectibleCollection },
  { key: 'PatreonName', get: (i) => i.patreonName },
]

// Patches only the known flat fields inside each item's @GUID block (indent
// 2 = item entry, indent 3 = flat field — see parseParalivesSetting's indent
// layout comment), preserving every other line — array blocks, GUID,
// CustomModGUID, Prefab, DisplayName, indentation, and the original line
// ending style — byte-for-byte.
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
          return `${leadingWhitespace}=${key}:${field.get(currentItem)}`
        }
      }
    }

    return rawLine
  })

  return patched.join(usesCRLF ? '\r\n' : '\n')
}

export async function exportItemMod(project: ModProject): Promise<void> {
  const originalZipBlob = await assetDb.getFile(`original_zip_${project.id}`)
  if (!originalZipBlob) {
    throw new Error(
      'No original mod files found for this project — it was created directly in the Studio rather than imported, so there is nothing to re-export yet.'
    )
  }

  const zip = await JSZip.loadAsync(originalZipBlob)
  const paths = Object.keys(zip.files).filter((p) => !p.includes('__MACOSX/'))

  const itemsSettingPath = paths.find((p) => p.endsWith('Items.setting'))
  if (itemsSettingPath) {
    const originalText = await zip.files[itemsSettingPath].async('string')
    zip.file(itemsSettingPath, patchItemsSetting(originalText, project.items))
  }

  // Swap in the current workshop thumbnail, if one is set in the Studio
  if (project.coverThumbnailKey) {
    const thumbBlob = await assetDb.getFile(project.coverThumbnailKey)
    const thumbPath = paths.find((p) => p.endsWith('.mod.thumbnail'))
    if (thumbBlob && thumbPath) zip.file(thumbPath, thumbBlob)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${project.name.replace(/\s+/g, '_')}.mod.zip`)
}
