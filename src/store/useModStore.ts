import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ModProject, Item } from '../types'

interface ModStore {
  currentProject: ModProject | null
  selectedItemId: string | null

  recentProjects: ModProject[]

  setProject: (project: ModProject | null) => void
  selectItem: (id: string | null) => void

  createProject: () => ModProject

  updateProject: (
    updates: Partial<ModProject>
  ) => void

  addItem: () => void
  addItemWith: (payload: Partial<Item>) => void

  saveProject: () => boolean

  loadRecentProjects: () => void
  updateItem: (id: string, updates: Partial<Item>) => void
  deleteItem: (id: string) => void
}

const RECENT_KEY = 'paralives-mod-studio-recent-projects'
const CURRENT_KEY = 'paralives-mod-studio-current-project'

const safeParse = (v: string | null) => {
  try {
    return v ? (JSON.parse(v) as ModProject[]) : []
  } catch (e) {
    return []
  }
}

const safeParseSingle = (v: string | null) => {
  try {
    return v ? (JSON.parse(v) as ModProject) : null
  } catch (e) {
    return null
  }
}

// Ensure the window checks happen properly during variable initialization
const initialRecent = typeof window !== 'undefined'
  ? safeParse(window.localStorage.getItem(RECENT_KEY))
  : []

const initialCurrent = typeof window !== 'undefined'
  ? safeParseSingle(window.localStorage.getItem(CURRENT_KEY))
  : null

export const useModStore = create<ModStore>()(
  subscribeWithSelector((set, get) => ({
    currentProject: initialCurrent,
    selectedItemId: null,
    recentProjects: initialRecent,

    setProject: (project) =>
      set({ currentProject: project, selectedItemId: null }),

    selectItem: (id) =>
      set({ selectedItemId: id }),

    createProject: () => {
      const newProject: ModProject = {
        id: crypto.randomUUID(),
        name: 'Untitled Mod',
        description: 'My amazing mod',
        version: '1.0.0',
        author: '',
        items: [],
        assets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      set({ currentProject: newProject })
      return newProject
    },

    updateProject: (updates) =>
      set((state) => {
        if (!state.currentProject) return state

        return {
          currentProject: {
            ...state.currentProject,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        }
      }),

    addItem: () =>
      set((state) => {
        if (!state.currentProject) return state

        return {
          currentProject: {
            ...state.currentProject,
            items: [
              ...state.currentProject.items,
              {
                id: crypto.randomUUID(),
                name: 'New Item',
                description: '',
                price: 0,
                tags: [],
              },
            ],
            updatedAt: new Date().toISOString(),
          },
        }
      }),

    addItemWith: (payload: Partial<Item>) =>
      set((state) => {
        if (!state.currentProject) return state

        const newItem: Item = {
          id: crypto.randomUUID(),
          name: payload.name || 'New Item',
          description: payload.description || '',
          price: typeof payload.price === 'number' ? payload.price : 0,
          tags: payload.tags || [],
          category: payload.category,
          thumbnail: payload.thumbnail,
          translations: payload.translations,
        }

        return {
          currentProject: {
            ...state.currentProject,
            items: [...state.currentProject.items, newItem],
            updatedAt: new Date().toISOString(),
          },
        }
      }),

    updateItem: (id: string, updates: Partial<Item>) =>
      set((state) => {
        if (!state.currentProject) return state

        const items = state.currentProject.items.map((it) =>
          it.id === id ? { ...it, ...updates } : it
        )

        return {
          currentProject: {
            ...state.currentProject,
            items,
            updatedAt: new Date().toISOString(),
          },
        }
      }),

    deleteItem: (id: string) =>
      set((state) => {
        if (!state.currentProject) return state

        const items = state.currentProject.items.filter((it) => it.id !== id)

        return {
          currentProject: {
            ...state.currentProject,
            items,
            updatedAt: new Date().toISOString(),
          },
        }
      }),

    saveProject: () => {
      const project = get().currentProject
      if (!project) return false

      let saved = true

      try {
        window.localStorage.setItem(CURRENT_KEY, JSON.stringify(project))
      } catch (e) {
        saved = false
      }

      set((state) => {
        const existing = state.recentProjects.filter((p) => p.id !== project.id)
        const updated = [project, ...existing].slice(0, 10)
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
        } catch (e) {
          saved = false
        }
        return { recentProjects: updated }
      })

      return saved
    },

    loadRecentProjects: () => {
      if (typeof window === 'undefined') return
      const loaded = safeParse(window.localStorage.getItem(RECENT_KEY))
      set({ recentProjects: loaded })
    },
  }))
)

// --- BACKGROUND AUTO-SAVE SIDE EFFECT REACTOR ---
if (typeof window !== 'undefined') {
  useModStore.subscribe(
    (state) => state.currentProject,
    (currentProject) => {
      if (currentProject) {
        window.localStorage.setItem(CURRENT_KEY, JSON.stringify(currentProject))
      } else {
        window.localStorage.removeItem(CURRENT_KEY)
      }
    },
    { fireImmediately: false }
  )
}