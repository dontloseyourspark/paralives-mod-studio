export interface ModProject {
  id: string
  name: string
  description: string
  version: string
  author: string
  items: Item[]
  prefabs: Prefab[] // <--- Relational table for tracking extracted configurations
  updatedAt: string
}

export interface Item {
  id: string              // Internal tool UUID
  guid: string            // Real Paralives Mod GUID string
  name: string            // Display Name
  prefabId: string | null // Link to the relational Prefab table
  
  // Muted Metadata Category Groups
  placement: {
    priceOverride: number
    priceMultiplier: number
    multipurchaseOverride: boolean
    autoSelect: boolean
  }
  tags: string[]
  swatchGroup: string | null
  uiVariants: any[]       // Extensible bucket for later phases
}

export interface Prefab {
  id: string              // Linked to item.prefabId
  name: string            // New Prefab Name
  copyFromTarget: string  // Prefab To Copy reference string
  rootNodes: PrefabNode[] // Flattened array of node hierarchy entities
}

export interface PrefabNode {
  id: string              // Unique node identifier
  type: 'root' | 'child'
  name: string            // e.g., "📦 Root Node" or "🔷 Front Left Leg Mesh"
  components: EntityComponent[]
}

export interface EntityComponent {
  id: string              // Instance UUID
  type: string            // e.g., "ItemObjectRoot", "ItemMeshReference"
  properties: Record<string, any> // Key-value store matching your property schemas
}