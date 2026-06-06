// src/types/types.ts

export interface ComponentNode {
  id: string
  type: string
  properties: Record<string, any>
}

export interface Item {
  id: string
  guid: string
  name: string
  description: string
  price: number
  tags: string[]
  
  // Persistent asset registry cache markers
  thumbnailKey: string | null
  textureKeys: Record<string, string>
  
  componentBlueprints: {
    rootDefaultStates: string[]
    materialSurfaces: string[]
  }
  components: ComponentNode[]
}

export interface ModProject {
  id: string
  name: string
  description: string
  version: string
  author: string
  
  // Master workshop cover illustration lookup link
  coverThumbnailKey: string | null
  
  items: Item[]
  assets: any[]
  createdAt: string
  updatedAt: string
}