import { create } from 'zustand'
import type { ModProject } from '../types'

interface ModStore {
  currentProject: ModProject | null

  setProject: (project: ModProject) => void

  createProject: () => ModProject

  updateProject: (
    updates: Partial<ModProject>
  ) => void

  addItem: () => void
}

export const useModStore = create<ModStore>((set, get) => ({
  currentProject: null,

  setProject: (project) =>
    set({ currentProject: project }),

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
        },
      }
    }),
}))