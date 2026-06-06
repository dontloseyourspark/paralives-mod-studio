import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { assetDb } from '../utils/assetDb'
import type { ModProject, Item } from '../types/types'

// Update the interface contract block at the top of useModStore.ts
interface ModStoreState {
  currentProject: ModProject | null
  recentProjects: ModProject[]
  selectedItemId: string | null
  binaryFileCache: Record<string, File | Blob>
  stringUrlCache: Record<string, string>
  
  // NEW STATE FLAG: Tracking boot synchronization readiness
  hasHydratedDisk: boolean 
  
  setProject: (project: ModProject) => void
  setSelectedItemId: (id: string | null) => void
  createProject: () => ModProject
  updateProject: (updatedProject: ModProject) => void
  saveProject: () => void
  addItemWith: (item: Item) => void
  updateItem: (updatedItem: Item) => void
  deleteItem: (itemId: string) => void
  registerFileInCache: (key: string, file: File | Blob) => void
  getBlobUrlFromCache: (key: string | null) => string | null
  hydrateCacheFromDisk: () => Promise<void>
  clearCache: () => void
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
      hasHydratedDisk: false, // Starts as false on browser boot cold start

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
            hasHydratedDisk: true // NEW: Signal that the store data structures are completely loaded
          })
          console.log(`[Store:hydrateCacheFromDisk] Rehydrated ${Object.keys(storedRecords).length} mod resources from IndexedDB.`)
        } catch (err) {
          console.error('[Store:hydrateCacheFromDisk] Rehydration error:', err)
          set({ hasHydratedDisk: true }) // Set to true anyway on fault to prevent UI deadlock states
        }
      },

      setProject: (project) => set((state) => {
        const projectExists = state.recentProjects.some((p) => p.id === project.id)
        const updatedHistory = projectExists
          ? state.recentProjects.map((p) => p.id === project.id ? project : p)
          : [project, ...state.recentProjects]

        return {
          currentProject: project,
          recentProjects: updatedHistory
        }
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

        set({
          currentProject: timestampedProject,
          recentProjects: recentProjects.map((p) =>
            p.id === timestampedProject.id ? timestampedProject : p
          )
        })
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
          selectedItemId: newItem.id,
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

        const itemToDelete = state.currentProject.items.find(i => i.id === itemId)
        const updatedItems = state.currentProject.items.filter((item) => item.id !== itemId)
        
        const updatedProject = {
          ...state.currentProject,
          items: updatedItems,
          updatedAt: new Date().toISOString()
        }

        const nextSelectedId = state.selectedItemId === itemId 
          ? (updatedItems[0]?.id ?? null) 
          : state.selectedItemId

        // Asynchronously strip strings from runtime memory
        const freshUrlCache = { ...state.stringUrlCache }
        if (itemToDelete?.thumbnailKey) {
          assetDb.deleteFile(itemToDelete.thumbnailKey).catch(console.error)
          if (freshUrlCache[itemToDelete.thumbnailKey]) {
            URL.revokeObjectURL(freshUrlCache[itemToDelete.thumbnailKey])
            delete freshUrlCache[itemToDelete.thumbnailKey]
          }
        }
        if (itemToDelete?.textureKeys) {
          Object.values(itemToDelete.textureKeys).forEach(k => {
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
          )
        }
      }),

      registerFileInCache: (key, file) => {
        assetDb.saveFile(key, file).catch((err) => 
          console.error(`[Store:registerFileInCache] IndexedDB Write Failure: ${key}`, err)
        )
        
        set((state) => ({
          binaryFileCache: { ...state.binaryFileCache, [key]: file }
        }))
      },

      getBlobUrlFromCache: (key) => {
        if (!key || key === 'PROJECT_COVER_MASTER') return null

        // 1. If we have already generated a stable URL string this session, return it instantly!
        const existingUrl = get().stringUrlCache[key]
        if (existingUrl) {
          return existingUrl
        }

        // 2. Check if the raw file chunk is loaded into RAM
        const cachedBinary = get().binaryFileCache[key]
        if (cachedBinary) {
          const freshUrl = URL.createObjectURL(cachedBinary)
          
          // Stash the generated URL string directly into state to lock down re-renders
          set((state) => ({
            stringUrlCache: { ...state.stringUrlCache, [key]: freshUrl }
          }))
          return freshUrl
        }

        // 3. Trigger asynchronous background recovery out of IndexedDB disk blocks
        assetDb.getFile(key).then((dbFile) => {
          if (dbFile) {
            const recoveryUrl = URL.createObjectURL(dbFile)
            set((state) => ({
              binaryFileCache: { ...state.binaryFileCache, [key]: dbFile },
              stringUrlCache: { ...state.stringUrlCache, [key]: recoveryUrl }
            }))
          }
        }).catch((err) => {
          console.error(`[Store:getBlobUrlFromCache] Transaction fault on key: ${key}`, err)
        })

        return null
      },

      hydrateCacheFromDisk: async () => {
        try {
          const storedRecords = await assetDb.getAllFiles()
          
          // Pre-generate stable session URLs for every file located on disk
          const rehydratedUrlCache: Record<string, string> = {}
          Object.entries(storedRecords).forEach(([key, binary]) => {
            rehydratedUrlCache[key] = URL.createObjectURL(binary)
          })

          set({ 
            binaryFileCache: storedRecords,
            stringUrlCache: rehydratedUrlCache
          })
          console.log(`[Store:hydrateCacheFromDisk] Rehydrated ${Object.keys(storedRecords).length} mod resources straight into memory maps.`)
        } catch (err) {
          console.error('[Store:hydrateCacheFromDisk] Rehydration error:', err)
        }
      },

      clearCache: () => {
        set({ currentProject: null, selectedItemId: null })
      },

      purgeEntireStudioDatabase: async () => {
        try {
          // Explicit master purge cleans out open browser pointer references to prevent leaks
          Object.values(get().stringUrlCache).forEach((url) => URL.revokeObjectURL(url))
          await assetDb.clearAll()
          
          set({ 
            binaryFileCache: {}, 
            stringUrlCache: {},
            currentProject: null, 
            selectedItemId: null, 
            recentProjects: [] 
          })
          console.log('[Store:purgeEntireStudioDatabase] Persistent storage cleared cleanly.')
        } catch (err) {
          console.error('Failed to complete hard disk clear pass:', err)
        }
      }
    }),
    {
      name: 'paralives-studio-storage',
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        binaryFileCache: currentState.binaryFileCache,
        stringUrlCache: currentState.stringUrlCache // Retain generated addresses on route merges
      }),
      partialize: (state) => ({ recentProjects: state.recentProjects }),
    }
  )
)