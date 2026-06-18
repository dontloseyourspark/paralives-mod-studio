// src/types/types.ts

export type ModType = 'item' | 'translation' | 'surface'

export interface ComponentNode {
  id: string
  type: string
  properties: Record<string, any>
}

export interface TranslationData {
  language: string;
  strings: Record<string, string>;
}

export interface Item {
  id: string
  guid: string
  name: string
  description: string
  price: number
  tags: string[]
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
  modType: ModType           // Determines which editor view loads
  modGuid?: string           // Paralives ModGUID from _mod.meta — stable across export/re-import
  name: string
  description: string
  version: string
  author: string
  coverThumbnailKey: string | null
  items: Item[]
  assets: any[]
  translations?: TranslationData[]
  createdAt: string
  updatedAt: string
}