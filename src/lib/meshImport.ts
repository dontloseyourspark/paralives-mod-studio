// src/lib/meshImport.ts
//
// Shared "import/replace mesh for a node" logic, used by both the Prefab
// tab's AssetMesh row (ItemEditorPanel.tsx) and the viewport's empty-state
// import prompt (MeshViewport.tsx) so the two stay in sync.
//
// Throws a human-readable Error (safe to show in the UI) if the file isn't a
// usable FBX or couldn't be persisted — callers surface it rather than letting
// the viewport fail later with a generic "couldn't load this mesh".

import type { ComponentNode, Item } from '../types/types'

/**
 * Sniff whether the file is an FBX three.js's FBXLoader can actually read:
 * a binary FBX (magic string "Kaydara FBX Binary") or an ASCII FBX
 * (contains "FBXHeaderVersion"). Returns a reason string if it's NOT usable,
 * or null if it looks fine.
 */
async function fbxRejectionReason(file: File): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith('.fbx')) {
    return `“${file.name}” isn't an FBX file. Paralives meshes must be .fbx — export or convert your model to FBX first.`
  }
  if (file.size === 0) {
    return `“${file.name}” is empty (0 bytes).`
  }
  // Read a small header window and check for either FBX signature.
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const asText = new TextDecoder('latin1').decode(header)
  const isBinary = asText.startsWith('Kaydara FBX Binary')
  const isAscii = asText.includes('FBXHeaderVersion') || asText.trimStart().startsWith('; FBX')
  if (!isBinary && !isAscii) {
    return `“${file.name}” doesn't look like a valid FBX (it may be renamed or a different format like OBJ/GLB). Re-export it as FBX.`
  }
  return null
}

export async function importMeshForNode(item: Item, node: ComponentNode, file: File): Promise<Item> {
  const reason = await fbxRejectionReason(file)
  if (reason) throw new Error(reason)

  const { assetDb } = await import('../utils/assetDb')
  const newGuid = String(Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000)
  const cacheKey = `mesh_${newGuid}`

  const saved = await assetDb.saveFileRaw(cacheKey, file)
  if (!saved) {
    throw new Error(
      `Couldn't save “${file.name}” — this browser's storage may be full or blocked. ` +
      `Try a smaller mesh, or free up space and reload.`,
    )
  }
  // Verify it's actually retrievable before we point the node at it, so a
  // partial/quota failure surfaces here instead of as a broken viewport.
  const readback = await assetDb.getFile(cacheKey)
  if (!readback) {
    throw new Error(
      `“${file.name}” didn't persist correctly (it may be too large for this browser). ` +
      `Try a smaller mesh.`,
    )
  }

  const updatedComponents = item.components.map((c) =>
    c.id === node.id && c.type === node.type
      ? { ...c, properties: { ...c.properties, AssetMesh: newGuid } }
      : c
  )
  return { ...item, components: updatedComponents, meshKeys: { ...item.meshKeys, [newGuid]: cacheKey } }
}
