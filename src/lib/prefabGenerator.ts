// src/lib/prefabGenerator.ts
//
// Pure function that serialises a parsed ComponentNode[] back into a valid
// Paralives .prefab file.
//
// Format reference (validated against real mods — see CLAUDE.md):
//
//   ItemObject:{nodeGuid}        ← indent 0
//    Name:{nodeName}             ← indent 1
//    ParentGUID:{parentGuid}     ← indent 1  (child nodes only)
//    ChildIndex:{n}              ← indent 1  (child nodes only)
//   ComponentType:               ← indent 0
//    Property:Value              ← indent 1
//    SubBlockKey:                ← indent 1  (empty value = sub-block opener)
//     SubKey:SubValue            ← indent 2
//    Surfaces:                   ← indent 1  (special block)
//     Surface:                   ← indent 2
//      GUID:{guid}               ← indent 3
//      Value:{guid}              ← indent 3
//   ---                          ← node separator (trailing after last node too)
//
// Line endings: LF (\n) — confirmed from real mods. No BOM.
// Trailing newline after the final ---: YES.
//
// GUID precision: all GUIDs must be stored as strings, not numbers.
// The parser now stores AssetMesh as a raw string; all other large numeric
// GUIDs that went through parseFloat are precision-lossy but we emit them
// as-is (they were already in the stored node — we don't manufacture new ones
// from user edits here, we just round-trip what we parsed).
//
// Property round-trip rules (mirrors parsePrefabGraph in ModImporter):
//   number[]         → (x.4f, y.4f, z.4f)   e.g. [0.5,0.5,0.5] → (0.5000, 0.5000, 0.5000)
//   number           → String(n)             (integers emit without decimals)
//   string           → as-is
//   null             → sub-block opener with no value   e.g. "ItemMeshReferences:"
//   { _value, ...sub } → parent line with _value, then sub-props at indent+1
//   { ...sub } (no _value) → parent line with empty value, then sub-props at indent+1
//
// ItemMeshReferences special block: re-emitted from the meshRefRegistry
// (node.properties.AssetMesh collected per node during import). This is the
// ONLY place AssetMesh is written — as a registry on the root node's
// ItemObjectRoot component, mapping every node GUID → its AssetMesh.

import type { ComponentNode, Item, PrefabPropertyValue } from '../types/types'

const LF = '\n'

// ── Value formatters ──────────────────────────────────────────────────────────

function formatVector(v: number[]): string {
  return '(' + v.map(n => n.toFixed(4)).join(', ') + ')'
}

function formatScalar(v: number | string): string {
  if (typeof v === 'number') {
    // Integers (0, 1, 2…) emit without decimal point.
    // Floats emit with up to 4 decimal places, trailing zeros stripped,
    // but always keeping at least one decimal digit (e.g. 0.5, not 0.5000).
    if (Number.isInteger(v)) return String(v)
    const s = v.toFixed(4)
    // Strip trailing zeros after decimal, keep at least one decimal digit
    return s.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '.0')
  }
  return v
}

// Emit a property line at a given indent depth.
// depth 1 = one space, depth 2 = two spaces, depth 3 = three spaces.
function propLine(depth: number, key: string, value: string): string {
  return ' '.repeat(depth) + key + ':' + value + LF
}

// ── Property serialiser (handles the full PrefabPropertyValue union) ──────────

function serializeProperty(
  depth: number,
  key: string,
  val: PrefabPropertyValue
): string {
  // number[] → vector tuple
  if (Array.isArray(val)) {
    return propLine(depth, key, formatVector(val as number[]))
  }

  // null → sub-block opener with empty value (e.g. "ItemMeshReferences:")
  // These are re-emitted as empty markers; special blocks (ItemMeshReferences)
  // are written separately by the node serialiser.
  if (val === null) {
    return propLine(depth, key, '')
  }

  // object → parent line + indented sub-properties
  if (typeof val === 'object') {
    const obj = val as Record<string, PrefabPropertyValue | undefined>
    const parentVal = obj['_value']
    let out = ''

    if (parentVal !== undefined) {
      // Has a scalar parent value (e.g. IsScalable:True with sub-props)
      out += propLine(depth, key, Array.isArray(parentVal)
        ? formatVector(parentVal as number[])
        : formatScalar(parentVal as number | string))
    } else {
      // No parent value — emit as sub-block opener (empty value)
      out += propLine(depth, key, '')
    }

    for (const [subKey, subVal] of Object.entries(obj)) {
      if (subKey === '_value' || subVal === undefined) continue
      out += serializeProperty(depth + 1, subKey, subVal)
    }

    return out
  }

  // number or string → flat scalar
  return propLine(depth, key, formatScalar(val as number | string))
}

// ── Surfaces block ─────────────────────────────────────────────────────────────

function serializeSurfaces(surfaces: { guid: string; value: string }[]): string {
  if (!surfaces || surfaces.length === 0) return ''
  let out = ' Surfaces:' + LF
  for (const surf of surfaces) {
    out += '  Surface:' + LF
    out += '   GUID:' + surf.guid + LF
    out += '   Value:' + surf.value + LF
  }
  return out
}

// ── ItemMeshReferences registry block ─────────────────────────────────────────
// Emitted on the root node's ItemObjectRoot component.
// Maps every node GUID (root + children) to their AssetMesh GUID.
// Format (indent 1/2/3):
//  ItemMeshReferences:
//   GUID:{nodeGuid}
//    AssetMesh:{assetGuid}

function serializeMeshReferencesRegistry(
  meshNodes: ComponentNode[]  // all ItemMeshReference nodes, root first
): string {
  // Only emit if at least one node has AssetMesh
  const hasAny = meshNodes.some(n => n.properties['AssetMesh'] != null)
  if (!hasAny) return ''

  let out = ' ItemMeshReferences:' + LF
  for (const node of meshNodes) {
    const assetMesh = node.properties['AssetMesh']
    if (assetMesh == null) continue
    out += '  GUID:' + node.id + LF
    out += '   AssetMesh:' + String(assetMesh) + LF
  }
  return out
}

// ── Component serialiser ──────────────────────────────────────────────────────

function serializeComponent(
  comp: ComponentNode,
  allMeshNodes: ComponentNode[]  // passed through for ItemMeshReferences registry
): string {
  let out = ''

  // Component heading (indent 0, no leading space)
  out += comp.type + ':' + LF

  // Special-case: ItemObjectRoot gets the ItemMeshReferences registry block
  if (comp.type === 'ItemObjectRoot') {
    // Emit standard properties first, then the registry block
    for (const [key, val] of Object.entries(comp.properties)) {
      // Skip the registry placeholder (stored as null) and AssetMesh
      // (which belongs in the registry block, not as a flat property)
      if (key === 'ItemMeshReferences' || key === 'AssetMesh') continue
      out += serializeProperty(1, key, val)
    }
    // Emit the registry block
    out += serializeMeshReferencesRegistry(allMeshNodes)
    return out
  }

  // Special-case: ItemMeshReference — emit MeshIndex first (if present),
  // then Surfaces block, then texture slot properties, then everything else.
  if (comp.type === 'ItemMeshReference') {
    // MeshIndex first
    if (comp.properties['MeshIndex'] != null) {
      out += serializeProperty(1, 'MeshIndex', comp.properties['MeshIndex'])
    }

    // Surfaces block
    if (comp.surfaces && comp.surfaces.length > 0) {
      out += serializeSurfaces(comp.surfaces)
    } else {
      // Always emit at least an empty-ish Surfaces block if the node would have
      // one in a real mod (non-recolorable items use BASE_GAME_DETAIL_SURFACE_GUID)
      // Only omit if there are truly no surfaces defined.
    }

    // Remaining flat properties (skip MeshIndex already emitted, skip AssetMesh registry)
    const SKIP = new Set(['MeshIndex', 'AssetMesh', 'ItemMeshReferences'])
    for (const [key, val] of Object.entries(comp.properties)) {
      if (SKIP.has(key)) continue
      out += serializeProperty(1, key, val)
    }
    return out
  }

  // All other components (ItemCubeTransform, etc.) — emit properties in order
  for (const [key, val] of Object.entries(comp.properties)) {
    if (key === 'AssetMesh') continue  // never emit AssetMesh as a flat property
    out += serializeProperty(1, key, val)
  }

  return out
}

// ── Node serialiser ───────────────────────────────────────────────────────────

// Groups all components for a single node GUID and emits the full node block:
//   ItemObject:{guid}
//    Name:...
//    [ParentGUID/ChildIndex for child nodes]
//   Component1:
//    ...
//   Component2:
//    ...
//   ---

function serializeNode(
  nodeId: string,
  nodeComponents: ComponentNode[],
  parentId: string | undefined,
  allMeshNodes: ComponentNode[]
): string {
  // Use the first component to get node metadata (all share the same id/nodeName/childIndex)
  const meta = nodeComponents[0]
  let out = ''

  // ItemObject header
  out += 'ItemObject:' + nodeId + LF
  if (meta.nodeName) out += ' Name:' + meta.nodeName + LF
  if (parentId) out += ' ParentGUID:' + parentId + LF
  if (meta.childIndex !== undefined) out += ' ChildIndex:' + meta.childIndex + LF

  // Emit components in canonical order: ItemObjectRoot → ItemCubeTransform → ItemMeshReference
  const ORDER = ['ItemObjectRoot', 'ItemCubeTransform', 'ItemMeshReference']
  const sorted = [...nodeComponents].sort((a, b) => {
    const ai = ORDER.indexOf(a.type)
    const bi = ORDER.indexOf(b.type)
    // Unknown types go last
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  for (const comp of sorted) {
    out += serializeComponent(comp, allMeshNodes)
  }

  out += '---' + LF

  return out
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Serialise an Item's component graph into a .prefab file string.
 *
 * Produces byte-compatible output with Paralives' own prefab files:
 * - LF line endings, no BOM
 * - Trailing `---\n` after every node (including the last)
 * - ItemMeshReferences registry emitted on root's ItemObjectRoot
 * - Surfaces block emitted on ItemMeshReference nodes
 * - Sub-properties (IsScalable, etc.) emitted with correct indent
 *
 * @param item - The item whose `components` array contains the parsed graph
 * @returns LF-terminated string ready to write to `Prefabs/{name}.prefab`
 */
export function generatePrefab(item: Item): string {
  const { components } = item
  if (!components || components.length === 0) return ''

  // Collect all ItemMeshReference nodes (for the registry block)
  // sorted root first, then children by childIndex
  const allMeshNodes = components
    .filter(c => c.type === 'ItemMeshReference')
    .sort((a, b) => (a.childIndex ?? -1) - (b.childIndex ?? -1))

  // Group components by node ID — each unique ID is one node block
  const nodeMap = new Map<string, ComponentNode[]>()
  for (const comp of components) {
    if (!nodeMap.has(comp.id)) nodeMap.set(comp.id, [])
    nodeMap.get(comp.id)!.push(comp)
  }

  // Determine node order: root node first (no childIndex on any component),
  // then children in childIndex order.
  // Root = the node whose components all have childIndex === undefined
  // Child = the node whose ItemMeshReference has childIndex defined
  const nodeIds = [...nodeMap.keys()]

  const rootId = nodeIds.find(id => {
    const comps = nodeMap.get(id)!
    return comps.every(c => c.childIndex === undefined)
  })

  if (!rootId) {
    // Fallback: just emit in map order
    return [...nodeMap.entries()]
      .map(([id, comps]) => serializeNode(id, comps, undefined, allMeshNodes))
      .join('')
  }

  const childIds = nodeIds
    .filter(id => id !== rootId)
    .sort((a, b) => {
      const aIdx = nodeMap.get(a)!.find(c => c.childIndex !== undefined)?.childIndex ?? 999
      const bIdx = nodeMap.get(b)!.find(c => c.childIndex !== undefined)?.childIndex ?? 999
      return aIdx - bIdx
    })

  let out = ''

  // Root node (no ParentGUID, no ChildIndex)
  out += serializeNode(rootId, nodeMap.get(rootId)!, undefined, allMeshNodes)

  // Child nodes (ParentGUID = rootId)
  for (const childId of childIds) {
    out += serializeNode(childId, nodeMap.get(childId)!, rootId, allMeshNodes)
  }

  return out
}

// ── Sidecar generators ────────────────────────────────────────────────────────

/**
 * Generate a .prefab.meta sidecar for a prefab asset.
 * Type:201, same 4-line bare format as .fbx.meta and .png.meta.
 * ImportFileCheckSum is left empty — game backfills on first load.
 *
 * @param prefabGuid - The prefab's asset GUID (from item.prefabGuid, or a freshly generated one)
 * @returns LF-terminated string (prefab metas use LF like the prefab itself)
 */
export function generatePrefabMeta(prefabGuid: string): string {
  return [
    'GUID:' + prefabGuid,
    'Type:201',
    'UpdatedToGameVersion:20057',
    'ImportFileCheckSum:',
  ].join(LF) + LF
}

/**
 * Generate a Settings/*.setting.meta sidecar.
 * Type:203, used for Items.setting, Translations.setting, etc.
 * Line endings: LF (matches prefab convention for sidecars).
 *
 * @param settingGuid - A freshly generated or preserved GUID for this sidecar
 */
export function generateSettingMeta(settingGuid: string): string {
  return [
    'GUID:' + settingGuid,
    'Type:203',
    'UpdatedToGameVersion:20057',
    'ImportFileCheckSum:',
  ].join(LF) + LF
}

/**
 * Generate _Metacache/Prefabs.Metacache content.
 * Maps prefab filename → prefab GUID. Used by the game to resolve Prefab: GUIDs.
 *
 * Format (LF line endings):
 *   Prefabs/{PrefabName}.prefab
 *   GUID:{prefabGuid}
 *   Type:201
 *   ModGUID:{modGuid}
 *   (blank line between entries)
 */
export function generatePrefabsMetacache(
  prefabName: string,
  prefabGuid: string,
  modGuid: string
): string {
  return [
    'Prefabs/' + prefabName + '.prefab',
    'GUID:' + prefabGuid,
    'Type:201',
    'ModGUID:' + modGuid,
  ].join(LF) + LF
}

/**
 * Generate _Metacache/.Metacache content.
 * Lists every mod-owned asset (FBX + PNG files) — NOT settings files.
 * When no assets: 3-byte UTF-8 BOM only (handled by the exporter, not here).
 *
 * Format per asset (LF line endings):
 *   {filename}
 *   GUID:{assetGuid}
 *   Type:{1 for FBX, 2 for PNG}
 *   ModGUID:{modGuid}
 *   (blank line between entries)
 */
export function generateDotMetacache(
  assets: { filename: string; guid: string; type: 1 | 2 }[],
  modGuid: string
): string {
  if (assets.length === 0) return ''  // caller emits BOM for empty case

  return assets.map(a =>
    [a.filename, 'GUID:' + a.guid, 'Type:' + a.type, 'ModGUID:' + modGuid].join(LF)
  ).join(LF + LF) + LF
}

/**
 * Generate _Metacache/Settings.Metacache content.
 * Lists Settings files (not assets). Always includes Items.setting and
 * Translations.setting; also ItemMeshReference.setting and ItemObjectRoot.setting.
 *
 * Format per entry (LF line endings):
 *   Settings/{Name}.setting
 *   GUID:{settingGuid}
 *   Type:203
 *   ModGUID:{modGuid}
 */
export function generateSettingsMetacache(
  settings: { name: string; guid: string }[],
  modGuid: string
): string {
  return settings.map(s =>
    ['Settings/' + s.name + '.setting', 'GUID:' + s.guid, 'Type:203', 'ModGUID:' + modGuid].join(LF)
  ).join(LF + LF) + LF
}