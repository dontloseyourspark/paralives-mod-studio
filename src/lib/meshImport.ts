// src/lib/meshImport.ts
//
// Shared "import/replace mesh for a node" logic, used by both the Prefab
// tab's AssetMesh row (ItemEditorPanel.tsx) and the viewport's empty-state
// import prompt (MeshViewport.tsx) so the two stay in sync.

import type { ComponentNode, Item } from '../types/types'

export async function importMeshForNode(item: Item, node: ComponentNode, file: File): Promise<Item> {
  const { assetDb } = await import('../utils/assetDb')
  const newGuid = String(Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000)
  const cacheKey = `mesh_${newGuid}`
  await assetDb.saveFileRaw(cacheKey, file)
  const updatedComponents = item.components.map((c) =>
    c.id === node.id && c.type === node.type
      ? { ...c, properties: { ...c.properties, AssetMesh: newGuid } }
      : c
  )
  return { ...item, components: updatedComponents, meshKeys: { ...item.meshKeys, [newGuid]: cacheKey } }
}
