// src/lib/itemModGenerator.ts
//
// Pure functions for generating Items.setting content from a list of Item objects.
//
// Format reference (from parseParalivesSetting in ModImporter.tsx):
//   #Setting.Items
//    =AllItems
//     @{itemGuid}                    — 2-space indent, item entry
//      =GUID:{itemGuid}              — 3-space indent, flat field
//      =CustomModGUID:{modGuid}
//      =DisplayName:{translationGuid}
//      =Prefab:{prefabGuid}
//      =HideFromCatalog:False
//      ...more flat fields...
//      =Tag                          — 3-space, array opener (no colon value)
//       @{entryGuid}                 — 4-space, array entry
//        =GUID:{entryGuid}           — 5-space, entry field
//        =CustomModGUID:{modGuid}
//        =Value:{tagGuid}
//      ...more array fields...
//
// Line endings: CRLF (\r\n) — confirmed from real .setting files.
// Encoding: UTF-8, no BOM.
//
// GUID precision note: Item.guid and all sub-entry GUIDs must be stored as
// strings (not numbers) to preserve 19-digit precision. This file assumes
// they already are — it never calls parseInt/parseFloat on them.
//
// Omission rules (matching observed real-mod behaviour):
//   - Boolean fields that are False are omitted unless they differ from the
//     game default (conservative: emit all booleans explicitly for now).
//   - String fields equal to their "unset" sentinel ('None', 'NoOverride', '0', '')
//     are omitted to keep the file clean and match real-mod output.
//   - Array blocks are omitted entirely when empty.
//   - DisplayName is always emitted (even if the GUID is a placeholder) because
//     the game uses it to look up the catalog name.

import type { Item, ItemTag, ItemColorZoneName, ItemMeshPart, ItemVariantEntry } from '../types/types'

const CRLF = '\r\n'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Emit a flat field at item level (3 spaces). */
function field(key: string, value: string | number): string {
  return `   =${key}:${value}${CRLF}`
}

/** Emit a boolean field (always explicit — game needs True/False literally). */
function boolField(key: string, value: boolean): string {
  return field(key, value ? 'True' : 'False')
}

/**
 * Emit an array block at item level.
 * Returns an empty string if entries is empty (omits the block entirely).
 *
 * @param key       - Array block name (e.g. 'Tag', 'ItemVariants')
 * @param entries   - Pre-formatted entry lines (each already CRLF-terminated)
 */
function arrayBlock(key: string, entries: string[]): string {
  if (entries.length === 0) return ''
  return `   =${key}${CRLF}` + entries.join('')
}

/**
 * Emit one array entry.
 * @param entryGuid - The @GUID for this entry (4-space indent)
 * @param fields    - Key/value pairs for the 5-space fields
 */
function arrayEntry(entryGuid: string, fields: [string, string][]): string {
  const header = `    @${entryGuid}${CRLF}`
  const body = fields.map(([k, v]) => `     =${k}:${v}${CRLF}`).join('')
  return header + body
}

/**
 * Derive a stable per-entry wrapper GUID from a value that has no GUID of its
 * own stored in our data model (e.g. a bare RopeItems/ResizeSnapProfiles
 * string). Deterministic so re-exporting the same data produces the same GUID.
 */
function deriveEntryGuid(seed: string): string {
  const digits = seed.replace(/[^0-9]/g, '').split('').reverse().join('')
  return digits.padEnd(19, '1').substring(0, 19)
}

// ── Per-item serializer ───────────────────────────────────────────────────────

/**
 * Serialize one Item to its @GUID block inside AllItems.
 *
 * @param item    - The item to serialize
 * @param modGuid - The mod's own GUID (written as CustomModGUID on every entry)
 */
function serializeItem(item: Item, modGuid: string): string {
  const lines: string[] = []

  // Item entry header
  lines.push(`  @${item.guid}${CRLF}`)

  // ── Identity ────────────────────────────────────────────────────────────────
  lines.push(field('GUID', item.guid))
  lines.push(field('CustomModGUID', modGuid))

  // DisplayName: always emit. For items built from scratch in the Studio, this
  // will be a generated translation GUID (see generateTranslationGuid on Item).
  // For imported items it's the original GUID captured on import.
  if (item.prefabGuid) {
    // DisplayName: use the GUID captured on import. For items built from scratch
    // in the Studio, displayNameGuid will be undefined — fall back to deriving a
    // stable numeric GUID from the item GUID (same digit-stripping approach used
    // for modGuid derivation in itemModExporter) until a proper name editor exists.
    const displayNameGuid = item.displayNameGuid
      ?? item.guid.replace(/[^0-9]/g, '').substring(0, 19).padEnd(19, '1')
    lines.push(field('DisplayName', displayNameGuid))
    lines.push(field('Prefab', item.prefabGuid))
  }

  // ── Catalog ─────────────────────────────────────────────────────────────────
  lines.push(boolField('HideFromCatalog', item.hideFromCatalog ?? false))
  lines.push(boolField('OverrideInteractionGroup', item.overrideInteractionGroup ?? false))
  lines.push(boolField('OverrideImpostorInteractions', item.overrideImpostorInteractions ?? false))

  // ── Tags ────────────────────────────────────────────────────────────────────
  const tagEntries = (item.tags ?? []).map((t: ItemTag) =>
    arrayEntry(t.guid, [
      ['GUID', t.guid],
      ['CustomModGUID', modGuid],
      ['Value', t.value],
    ])
  )
  lines.push(arrayBlock('Tag', tagEntries))

  // ── Swatch ──────────────────────────────────────────────────────────────────
  lines.push(boolField('HasSwatches', item.hasSwatches ?? false))
  if (item.swatchGroup && item.swatchGroup !== '') {
    lines.push(field('SwatchGroup', item.swatchGroup))
  }
  if (item.defaultSwatch && item.defaultSwatch !== '0') {
    lines.push(field('DefaultSwatch', item.defaultSwatch))
  }
  if ((item.swatchColorZoneCount ?? 0) !== 0) {
    lines.push(field('SwatchColorZoneCount', item.swatchColorZoneCount))
  }
  if ((item.swatchThumbnailType ?? 1) !== 1) {
    lines.push(field('SwatchThumbnailType', item.swatchThumbnailType))
  }

  const colorZoneEntries = (item.colorZoneNames ?? []).map((c: ItemColorZoneName) =>
    arrayEntry(c.guid, [
      ['GUID', c.guid],
      ['CustomModGUID', modGuid],
      ['Value', c.value],
    ])
  )
  lines.push(arrayBlock('ColorZoneNames', colorZoneEntries))

  // ── Placement ───────────────────────────────────────────────────────────────
  lines.push(field('PriceOverride', item.price ?? 0))
  if ((item.priceMultiplier ?? 1) !== 1) {
    lines.push(field('PriceMultiplier', item.priceMultiplier))
  }
  if (item.priceSkinProperty && item.priceSkinProperty !== 'None') {
    lines.push(field('PriceSkinProperty', item.priceSkinProperty))
  }
  if (item.multipurchaseOverride && item.multipurchaseOverride !== 'NoOverride') {
    lines.push(field('MultipurchaseOverride', item.multipurchaseOverride))
  }
  lines.push(boolField('AutoSelect', item.autoSelect ?? false))
  if (item.itemPlacementTweenOverride && item.itemPlacementTweenOverride !== 'None') {
    lines.push(field('ItemPlacementTweenOverride', item.itemPlacementTweenOverride))
  }

  const meshPartEntries = (item.meshParts ?? []).map((m: ItemMeshPart) =>
    arrayEntry(m.guid, [
      ['GUID', m.guid],
      ['CustomModGUID', modGuid],
      ['DisplayName', m.displayName],
    ])
  )
  lines.push(arrayBlock('MeshParts', meshPartEntries))

  // RopeItems / ResizeSnapProfiles store only bare GUID strings — there's no
  // separate per-entry "wrapper" GUID in our data model (unlike Tag/MeshParts/
  // etc., which each carry their own .guid), so one is derived deterministically
  // from the value itself so repeated exports of the same data are stable.
  const ropeItemEntries = (item.ropeItems ?? []).map((guid) =>
    arrayEntry(deriveEntryGuid(guid), [
      ['GUID', deriveEntryGuid(guid)],
      ['CustomModGUID', modGuid],
      ['Value', guid],
    ])
  )
  lines.push(arrayBlock('RopeItems', ropeItemEntries))

  const resizeSnapProfileEntries = (item.resizeSnapProfiles ?? []).map((guid) =>
    arrayEntry(deriveEntryGuid(guid), [
      ['GUID', deriveEntryGuid(guid)],
      ['CustomModGUID', modGuid],
      ['Value', guid],
    ])
  )
  lines.push(arrayBlock('ResizeSnapProfiles', resizeSnapProfileEntries))

  // ── Nested Prefab ───────────────────────────────────────────────────────────
  lines.push(boolField('OverrideNestedPrefabToSpawn', item.overrideNestedPrefabToSpawn ?? false))

  // ── Snapping ────────────────────────────────────────────────────────────────
  lines.push(boolField('OverrideSnap', item.overrideSnap ?? false))
  if (item.rotateToSnapOverride && item.rotateToSnapOverride !== 'NoOverride') {
    lines.push(field('RotateToSnapOverride', item.rotateToSnapOverride))
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  lines.push(boolField('AlwaysVisibleOnWalls', item.alwaysVisibleOnWalls ?? false))
  lines.push(boolField('RenderAsWall', item.renderAsWall ?? false))
  lines.push(boolField('OverrideItemFadingFromCamera', item.overrideItemFadingFromCamera ?? false))
  lines.push(boolField('CannotBatch', item.cannotBatch ?? false))

  // ── Animation / Bills / Dirtyness / Brokenness ──────────────────────────────
  if (item.overrideItemForAnimation && item.overrideItemForAnimation !== 'None') {
    lines.push(field('OverrideItemForAnimation', item.overrideItemForAnimation))
  }
  lines.push(boolField('IgnoreUsageLevelFromTags', item.ignoreUsageLevelFromTags ?? false))
  if (item.dirtinessSpeedTier && item.dirtinessSpeedTier !== 'None') {
    lines.push(field('DirtinessSpeedTier', item.dirtinessSpeedTier))
  }
  if (item.breakingSpeedTier && item.breakingSpeedTier !== 'None') {
    lines.push(field('BreakingSpeedTier', item.breakingSpeedTier))
  }

  // ── Variants ────────────────────────────────────────────────────────────────
  const variantEntries = (item.itemVariants ?? []).map((v: ItemVariantEntry) => {
    const fields: [string, string][] = [
      ['GUID', v.guid],
      ['CustomModGUID', modGuid],
      ['ItemVariantGUID', v.itemVariantGuid],
    ]
    if (v.useSurfaceThumbnailTexture) fields.push(['UseSurfaceThumbnailTexture', 'True'])
    return arrayEntry(v.guid, fields)
  })
  lines.push(arrayBlock('ItemVariants', variantEntries))

  lines.push(boolField('SynchronizeSwatchAmongVariants', item.synchronizeSwatchAmongVariants ?? false))
  lines.push(boolField('IgnoreRememberIndexForCategory', item.ignoreRememberIndexForCategory ?? false))
  lines.push(boolField('HasSizeVariantsOverrides', item.hasSizeVariantsOverrides ?? false))

  // ── Collectability / Patreon ────────────────────────────────────────────────
  if (item.collectibleCollection && item.collectibleCollection !== 'None') {
    lines.push(field('CollectibleCollection', item.collectibleCollection))
  }
  if (item.patreonName && item.patreonName !== '') {
    lines.push(field('PatreonName', item.patreonName))
  }

  return lines.join('')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate the full text content of an `Items.setting` file from a list of items.
 *
 * @param items   - The items to include (all items in the mod)
 * @param modGuid - The mod's own GUID — written as CustomModGUID on every entry
 * @returns CRLF-terminated string ready to write into the zip
 *
 * @example
 * const text = generateItemsSetting(project.items, project.modGuid ?? derivedGuid)
 * zip.file('Settings/Items.setting', text)
 */
export function generateItemsSetting(items: Item[], modGuid: string): string {
  const lines: string[] = []

  lines.push(`#Setting.Items${CRLF}`)
  lines.push(` =AllItems${CRLF}`)

  for (const item of items) {
    lines.push(serializeItem(item, modGuid))
  }

  return lines.join('')
}

/**
 * Generate the `Translations.setting` file for an item mod.
 *
 * Each item contributes one entry: the displayNameGuid as the key,
 * and the item's display name as the value. This is what the game
 * uses to resolve the catalog name shown in Build Mode.
 *
 * Items without a resolvable displayNameGuid are skipped — the game
 * would ignore a blank key anyway.
 *
 * Format (CRLF, same as all .setting files):
 *   #Setting.Translations
 *    =Items
 *     g{displayNameGuid}
 *      =Value:{item.name}
 *
 * IMPORTANT: the displayNameGuid derivation here must stay in sync with
 * serializeItem() in generateItemsSetting — both use the same fallback
 * so the key emitted here always matches the DisplayName: field there.
 *
 * @param items - The items to include
 * @returns CRLF-terminated string ready to write into the zip
 *
 * @example
 * const text = generateItemTranslationsSetting(project.items)
 * zip.file('Settings/Translations.setting', text)
 */
export function generateItemTranslationsSetting(items: Item[]): string {
  const lines: string[] = []

  lines.push(`#Setting.Translations${CRLF}`)
  lines.push(` =Items${CRLF}`)

  for (const item of items) {
    // Must stay in sync with the displayNameGuid derivation in serializeItem().
    const displayNameGuid = item.displayNameGuid
      ?? item.guid.replace(/[^0-9]/g, '').substring(0, 19).padEnd(19, '1')

    if (!displayNameGuid) continue

    lines.push(`  g${displayNameGuid}${CRLF}`)
    lines.push(`   =Value:${item.name}${CRLF}`)
  }

  return lines.join('')
}