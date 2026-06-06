import { create } from 'zustand'
import type { ModProject, Item } from '../types/types'

interface ModStoreState {
  currentProject: ModProject | null
  recentProjects: ModProject[]
  // Track the active item selection at the global store level
  selectedItemId: string | null
  selectItem: (id: string | null) => void // <-- ADD THIS LINE
  // Global persistent binary file buffers cache map
  binaryFileCache: Record<string, File>
  
  setProject: (project: ModProject) => void
  setSelectedItemId: (id: string | null) => void
  createProject: () => ModProject
  updateProject: (updatedProject: ModProject) => void
  saveProject: () => void
  
  // Item Level Entity CRUD Actions
  addItemWith: (item: Item) => void
  updateItem: (updatedItem: Item) => void
  deleteItem: (itemId: string) => void
  
  registerFileInCache: (key: string, file: File) => void
  getBlobUrlFromCache: (key: string | null) => string | null
  clearCache: () => void
}

export const useModStore = create<ModStoreState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  selectedItemId: null,
  binaryFileCache: {},

  setProject: (project) => set({ currentProject: project }),

  setSelectedItemId: (id) => set({ selectedItemId: id }),
  selectItem: (id) => set({ selectedItemId: id }), // <-- ADD THIS ALIAS LINE

  createProject: () => {
    const newProject: ModProject = {
      id: crypto.randomUUID(),
      name: 'New Custom Mod',
      description: 'A fresh standalone Paralives content configuration package.',
      version: '1.0.0',
      author: 'Studio Creator',
      coverThumbnailKey: null,
      items: [],
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    set((state) => ({
      currentProject: newProject,
      recentProjects: [newProject, ...state.recentProjects]
    }))
    
    return newProject
  },

  updateProject: (updatedProject) => set((state) => ({
    currentProject: updatedProject,
    recentProjects: state.recentProjects.map((p) => 
      p.id === updatedProject.id ? updatedProject : p
    )
  })),

  saveProject: () => {
    const { currentProject, recentProjects } = get()
    if (!currentProject) return

    const timestampedProject = {
      ...currentProject,
      updatedAt: new Date().toISOString()
    }

    // Commits changes to the persistent history stack
    set({
      currentProject: timestampedProject,
      recentProjects: recentProjects.map((p) =>
        p.id === timestampedProject.id ? timestampedProject : p
      )
    })
    console.log('Project committed securely to workspace manifest history.')
  },

  addItemWith: (newItem) => set((state) => {
    if (!state.currentProject) return state
    
    const updatedProject = {
      ...state.currentProject,
      items: [...state.currentProject.items, newItem],
      updatedAt: new Date().toISOString()
    }

    return {
      currentProject: updatedProject,
      selectedItemId: newItem.id, // Auto-select the newly spawned asset node
      recentProjects: state.recentProjects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      )
    }
  }),

  updateItem: (updatedItem) => set((state) => {
    if (!state.currentProject) return state
    
    const updatedItems = state.currentProject.items.map((item) => 
      item.id === updatedItem.id ? updatedItem : item
    )

    const updatedProject = {
      ...state.currentProject,
      items: updatedItems,
      updatedAt: new Date().toISOString()
    }

    return {
      currentProject: updatedProject,
      recentProjects: state.recentProjects.map((p) => 
        p.id === updatedProject.id ? updatedProject : p
      )
    }
  }),

  deleteItem: (itemId) => set((state) => {
    if (!state.currentProject) return state

    const updatedItems = state.currentProject.items.filter((item) => item.id !== itemId)
    
    const updatedProject = {
      ...state.currentProject,
      items: updatedItems,
      updatedAt: new Date().toISOString()
    }

    // Reset the selection pointer if the active item was deleted
    const nextSelectedId = state.selectedItemId === itemId 
      ? (updatedItems[0]?.id ?? null) 
      : state.selectedItemId

    return {
      currentProject: updatedProject,
      selectedItemId: nextSelectedId,
      recentProjects: state.recentProjects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      )
    }
  }),

  registerFileInCache: (key, file) => set((state) => ({
    binaryFileCache: { ...state.binaryFileCache, [key]: file }
  })),

  getBlobUrlFromCache: (key) => {
    if (!key) return null
    const file = get().binaryFileCache[key]
    if (!file) return null
    return URL.createObjectURL(file)
  },

  clearCache: () => set({ binaryFileCache: {}, currentProject: null, recentProjects: [], selectedItemId: null })
}))