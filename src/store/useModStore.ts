// src/store/useModStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { assetDb } from '../utils/assetDb'
import type { ModProject, Item, TranslationData } from '../types/types'

interface ModStoreState {
  currentProject: ModProject | null
  recentProjects: ModProject[]
  selectedItemId: string | null
  binaryFileCache: Record<string, File | Blob>
  stringUrlCache: Record<string, string>

  hasHydratedDisk: boolean

  setProject: (project: ModProject) => void
  setSelectedItemId: (id: string | null) => void
  createProject: () => ModProject
  updateProject: (updatedProject: ModProject) => void
  saveProject: () => void
  addItemWith: (item: Item) => void
  updateItem: (updatedItem: Item) => void
  deleteItem: (itemId: string) => void
  updateTranslationString: (lang: string, key: string, value: string) => void
  registerFileInCache: (key: string, file: File | Blob) => void
  getBlobUrlFromCache: (key: string | null) => string | null
  hydrateCacheFromDisk: () => Promise<void>
  clearWorkspaceSession: () => void
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
          translations: [],
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

      registerFileInCache: (key, file) => {
        assetDb.saveFile(key, file).catch((err) =>
          console.error(`[Store:registerFileInCache] IndexedDB write failure: ${key}`, err)
        )
        set((state) => ({
          binaryFileCache: { ...state.binaryFileCache, [key]: file },
        }))
      },

      getBlobUrlFromCache: (key) => {
        if (!key || key === 'PROJECT_COVER_MASTER') return null

        const existingUrl = get().stringUrlCache[key]
        if (existingUrl) return existingUrl

        const cachedBinary = get().binaryFileCache[key]
        if (cachedBinary) {
          const freshUrl = URL.createObjectURL(cachedBinary)
          set((state) => ({
            stringUrlCache: { ...state.stringUrlCache, [key]: freshUrl },
          }))
          return freshUrl
        }

        assetDb.getFile(key).then((dbFile) => {
          if (dbFile) {
            const recoveryUrl = URL.createObjectURL(dbFile)
            set((state) => ({
              binaryFileCache: { ...state.binaryFileCache, [key]: dbFile },
              stringUrlCache:  { ...state.stringUrlCache,  [key]: recoveryUrl },
            }))
          }
        }).catch((err) => {
          console.error(`[Store:getBlobUrlFromCache] Transaction fault on key: ${key}`, err)
        })

        return null
      },

      clearWorkspaceSession: () => {
        set({ currentProject: null, selectedItemId: null })
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
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        binaryFileCache: {},
        stringUrlCache: {},
        hasHydratedDisk: false,
      }),
    }
  )
)