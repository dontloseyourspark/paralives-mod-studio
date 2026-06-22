// src/store/useModStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { assetDb } from '../utils/assetDb'
import type { ModProject, Item, ModType } from '../types/types'

interface ModStoreState {
  currentProject: ModProject | null
  recentProjects: ModProject[]
  selectedItemId: string | null
  binaryFileCache: Record<string, File | Blob>
  stringUrlCache: Record<string, string>

  hasHydratedDisk: boolean

  setProject: (project: ModProject) => void
  setSelectedItemId: (id: string | null) => void
  createProject: (modType?: ModType) => ModProject
  updateProject: (updatedProject: ModProject) => void
  saveProject: () => void
  addItemWith: (item: Item) => void
  updateItem: (updatedItem: Item) => void
  deleteItem: (itemId: string) => void
  updateTranslationString: (lang: string, key: string, value: string) => void
  registerFileInCache: (key: string, file: File | Blob) => Promise<void>
  getBlobUrlFromCache: (key: string | null) => string | null
  hydrateCacheFromDisk: () => Promise<void>
  clearWorkspaceSession: () => void
  deleteProject: (projectId: string) => void
  clearAllProjects: () => void
  purgeEntireStudioDatabase: () => Promise<void>
}

export const useModStore = create<ModStoreState>()(
  persist(
    (set, get) => ({
      currentProject: null,
      recentProjects: [],
      selectedItemId: null,
      binaryFileCache: {},
      stringUrlCache: {},
      hasHydratedDisk: false,

      hydrateCacheFromDisk: async () => {
        try {
          const storedRecords = await assetDb.getAllFiles()

          const rehydratedUrlCache: Record<string, string> = {}
          Object.entries(storedRecords).forEach(([key, binary]) => {
            rehydratedUrlCache[key] = URL.createObjectURL(binary)
          })

          set({
            binaryFileCache: storedRecords,
            stringUrlCache: rehydratedUrlCache,
            hasHydratedDisk: true,
          })
        } catch (err) {
          console.error('[Store:hydrateCacheFromDisk] Rehydration error:', err)
          set({ hasHydratedDisk: true })
        }
      },

      setProject: (project) =>
        set((state) => {
          const exists = state.recentProjects.some((p) => p.id === project.id)
          const updatedHistory = exists
            ? state.recentProjects.map((p) => (p.id === project.id ? project : p))
            : [project, ...state.recentProjects]
          return { currentProject: project, recentProjects: updatedHistory }
        }),

      setSelectedItemId: (id) => set({ selectedItemId: id }),

      createProject: (modType: ModType = 'item') => {
        const newProject: ModProject = {
          id: crypto.randomUUID(),
          modType,
          name: 'New Custom Mod',
          description: 'A fresh standalone Paralives content configuration package.',
          version: '1.0.0',
          author: 'Studio Creator',
          coverThumbnailKey: null,
          items: [],
          assets: [],
          translations: [],
          workshopTags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => ({
          currentProject: newProject,
          recentProjects: [newProject, ...state.recentProjects],
        }))

        return newProject
      },

      updateProject: (updatedProject) =>
        set((state) => ({
          currentProject: updatedProject,
          recentProjects: state.recentProjects.map((p) =>
            p.id === updatedProject.id ? updatedProject : p
          ),
        })),

      saveProject: () => {
        const { currentProject, recentProjects } = get()
        if (!currentProject) return

        const timestamped = { ...currentProject, updatedAt: new Date().toISOString() }

        set({
          currentProject: timestamped,
          recentProjects: recentProjects.map((p) =>
            p.id === timestamped.id ? timestamped : p
          ),
        })
      },

      addItemWith: (newItem) =>
        set((state) => {
          if (!state.currentProject) return state

          const updatedProject = {
            ...state.currentProject,
            items: [...state.currentProject.items, newItem],
            updatedAt: new Date().toISOString(),
          }

          return {
            currentProject: updatedProject,
            selectedItemId: newItem.id,
            recentProjects: state.recentProjects.map((p) =>
              p.id === updatedProject.id ? updatedProject : p
            ),
          }
        }),

      updateItem: (updatedItem) =>
        set((state) => {
          if (!state.currentProject) return state

          const updatedProject = {
            ...state.currentProject,
            items: state.currentProject.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
            updatedAt: new Date().toISOString(),
          }

          return {
            currentProject: updatedProject,
            recentProjects: state.recentProjects.map((p) =>
              p.id === updatedProject.id ? updatedProject : p
            ),
          }
        }),

      deleteItem: (itemId) =>
        set((state) => {
          if (!state.currentProject) return state

          const itemToDelete = state.currentProject.items.find((i) => i.id === itemId)
          const updatedItems = state.currentProject.items.filter((item) => item.id !== itemId)

          const updatedProject = {
            ...state.currentProject,
            items: updatedItems,
            updatedAt: new Date().toISOString(),
          }

          const nextSelectedId =
            state.selectedItemId === itemId
              ? (updatedItems[0]?.id ?? null)
              : state.selectedItemId

          const freshUrlCache = { ...state.stringUrlCache }

          if (itemToDelete?.thumbnailKey) {
            assetDb.deleteFile(itemToDelete.thumbnailKey).catch(console.error)
            if (freshUrlCache[itemToDelete.thumbnailKey]) {
              URL.revokeObjectURL(freshUrlCache[itemToDelete.thumbnailKey])
              delete freshUrlCache[itemToDelete.thumbnailKey]
            }
          }

          if (itemToDelete?.textureKeys) {
            Object.values(itemToDelete.textureKeys).forEach((k) => {
              assetDb.deleteFile(k).catch(console.error)
              if (freshUrlCache[k]) {
                URL.revokeObjectURL(freshUrlCache[k])
                delete freshUrlCache[k]
              }
            })
          }

          return {
            currentProject: updatedProject,
            selectedItemId: nextSelectedId,
            stringUrlCache: freshUrlCache,
            recentProjects: state.recentProjects.map((p) =>
              p.id === updatedProject.id ? updatedProject : p
            ),
          }
        }),

      updateTranslationString: (lang, key, value) =>
        set((state) => {
          if (!state.currentProject || !state.currentProject.translations) return state

          const updatedTranslations = state.currentProject.translations.map((t) => {
            if (t.language !== lang) return t
            return {
              ...t,
              strings: { ...t.strings, [key]: value },
            }
          })

          const updatedProject = {
            ...state.currentProject,
            translations: updatedTranslations,
            updatedAt: new Date().toISOString(),
          }

          return {
            currentProject: updatedProject,
            recentProjects: state.recentProjects.map((p) =>
              p.id === updatedProject.id ? updatedProject : p
            ),
          }
        }),

      // Async so callers can await the full IndexedDB write before navigating away
      registerFileInCache: async (key, file) => {
        const freshUrl = URL.createObjectURL(file)

        set((state) => ({
          binaryFileCache: { ...state.binaryFileCache, [key]: file },
          stringUrlCache: { ...state.stringUrlCache, [key]: freshUrl }
        }))

        await assetDb.saveFile(key, file)
      },

      getBlobUrlFromCache: (key) => {
        // Null key = no image
        if (!key) return null

        const { stringUrlCache, binaryFileCache } = get()

        // 1. Check RAM first
        if (stringUrlCache[key]) return stringUrlCache[key]

        // 2. Synchronous fallback via localStorage
        const fallbackData = localStorage.getItem(`asset_fallback_${key}`)
        if (fallbackData) {
          return fallbackData
        }

        // 3. Fallback for active session binaries
        if (binaryFileCache[key]) {
          const freshUrl = URL.createObjectURL(binaryFileCache[key])
          setTimeout(() => {
            set((state) => ({
              stringUrlCache: { ...state.stringUrlCache, [key]: freshUrl },
            }))
          }, 0)
          return freshUrl
        }

        return null
      },

      clearWorkspaceSession: () => {
        set({ currentProject: null, selectedItemId: null })
      },

      // ── deleteProject ──────────────────────────────────────────────────────
      // Removes a single project from recentProjects and cleans up its cover
      // asset from the cache. If it's the currently open project, clears the
      // workspace session too.
      deleteProject: (projectId) => {
        const state = get()
        const project = state.recentProjects.find((p) => p.id === projectId)
        if (!project) return

        const freshUrlCache = { ...state.stringUrlCache }

        // Clean up the cover thumbnail asset
        if (project.coverThumbnailKey) {
          assetDb.deleteFile(project.coverThumbnailKey).catch(console.error)
          if (freshUrlCache[project.coverThumbnailKey]) {
            URL.revokeObjectURL(freshUrlCache[project.coverThumbnailKey])
            delete freshUrlCache[project.coverThumbnailKey]
          }
        }

        set({
          recentProjects: state.recentProjects.filter((p) => p.id !== projectId),
          currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
          selectedItemId: state.currentProject?.id === projectId ? null : state.selectedItemId,
          stringUrlCache: freshUrlCache,
        })
      },

      // ── clearAllProjects ───────────────────────────────────────────────────
      // Wipes the entire recent projects list and revokes all cover thumbnail
      // URLs. Does not touch item-level texture/thumbnail assets (those belong
      // to items within projects, not the project list itself).
      clearAllProjects: () => {
        const state = get()
        const freshUrlCache = { ...state.stringUrlCache }

        state.recentProjects.forEach((project) => {
          if (project.coverThumbnailKey) {
            assetDb.deleteFile(project.coverThumbnailKey).catch(console.error)
            if (freshUrlCache[project.coverThumbnailKey]) {
              URL.revokeObjectURL(freshUrlCache[project.coverThumbnailKey])
              delete freshUrlCache[project.coverThumbnailKey]
            }
          }
        })

        set({
          recentProjects: [],
          currentProject: null,
          selectedItemId: null,
          stringUrlCache: freshUrlCache,
        })
      },

      purgeEntireStudioDatabase: async () => {
        try {
          Object.values(get().stringUrlCache).forEach((url) => URL.revokeObjectURL(url))
          await assetDb.clearAll()

          set({
            binaryFileCache: {},
            stringUrlCache: {},
            currentProject: null,
            selectedItemId: null,
            recentProjects: [],
          })
        } catch (err) {
          console.error('[Store:purgeEntireStudioDatabase] Hard disk clear failed:', err)
        }
      },
    }),
    {
      name: 'paralives-studio-storage',
      partialize: (state) => ({
        recentProjects: state.recentProjects,
        currentProject: state.currentProject,
        selectedItemId: state.selectedItemId,
      }),
      merge: (persistedState: unknown, currentState) => {
        const ps = persistedState as Partial<ModStoreState>
        // Backfill modType on any persisted projects that predate this field — and
        // self-heal projects an earlier version of this migration already
        // mislabeled 'item' by blindly defaulting instead of inferring from content
        // (that wrong value then got written back to localStorage on the next save,
        // so it's "item" today even though it's really a translation mod).
        // A project with real translation data and no items is a translation mod
        // no matter what modType says; everything else keeps/gets 'item'.
        const migrate = (p: ModProject): ModProject => {
          const looksLikeTranslation = (p.translations?.length ?? 0) > 0 && (p.items?.length ?? 0) === 0
          if (p.modType && !(p.modType === 'item' && looksLikeTranslation)) return p
          return { ...p, modType: looksLikeTranslation ? 'translation' : ('item' as ModType) }
        }
        return {
          ...currentState,
          ...ps,
          recentProjects: (ps.recentProjects ?? []).map(migrate),
          currentProject: ps.currentProject ? migrate(ps.currentProject) : null,
          binaryFileCache: {},
          stringUrlCache: {},
          hasHydratedDisk: false,
        }
      },
    }
  )
)