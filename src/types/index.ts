export interface Item {
  id: string

  name: string
  description: string

  price: number

  tags: string[]

  category?: string

  thumbnail?: string

  translations?: Record<string, {
    name: string
    description: string
  }>
}

export interface Asset {
  id: string

  name: string
  path: string

  type:
    | 'mesh'
    | 'texture'
    | 'thumbnail'
    | 'other'
}

export interface ModProject {
  id: string

  name: string
  description: string

  version: string
  author: string

  items: Item[]
  assets: Asset[]

  createdAt: string
  updatedAt: string
}
