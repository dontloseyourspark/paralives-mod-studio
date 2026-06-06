import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types/types'

/**
 * All workspace logic for the project editor screen.
 *
 * This hook owns:
 *   - Deep-link rehydration (cold boot via URL projectId)
 *   - Derived state (activeSelectedItem)
 *   - Action handlers (add, delete, save, back)
 *
 * It returns pure data + callbacks. Zero JSX.
 * UI components should not contain any of this logic.
 */
export function useProjectWorkspace() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  // ── Store reads ────────────────────────────────────────────────────────────
  const currentProject  = useModStore((s) => s.currentProject)
  const recentProjects  = useModStore((s) => s.recentProjects)
  const selectedItemId  = useModStore((s) => s.selectedItemId)

  // ── Store mutations ────────────────────────────────────────────────────────
  const setProject        = useModStore((s) => s.setProject)
  const setSelectedItemId = useModStore((s) => s.setSelectedItemId)
  const updateProject     = useModStore((s) => s.updateProject)
  const saveProject       = useModStore((s) => s.saveProject)
  const clearCache        = useModStore((s) => s.clearCache)
  const addItemWith       = useModStore((s) => s.addItemWith)
  const updateItem        = useModStore((s) => s.updateItem)
  const deleteItem        = useModStore((s) => s.deleteItem)

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)
  // Blocks premature "no project" fallback screens during async rehydration
  const [isRehydrating, setIsRehydrating] = useState(true)

  // ── Deep-link rehydration ──────────────────────────────────────────────────
  // When the user navigates directly to /project/:id (cold boot, page refresh,
  // or shared link), the Zustand store may not have currentProject loaded yet.
  // We locate the matching record from persisted recentProjects and restore it.
  useEffect(() => {
    if (!currentProject && projectId && recentProjects.length > 0) {
      const match = recentProjects.find((p) => p.id === projectId)

      if (match) {
        setProject(match)
        // Auto-select the first item so the editor panel isn't empty on load
        if (match.items && match.items.length > 0) {
          setSelectedItemId(match.items[0].id)
        }
      } else {
        // Unknown project ID — redirect home rather than showing a broken state
        console.error(`[useProjectWorkspace] No project found for ID: ${projectId}`)
        navigate('/')
      }
    }
    setIsRehydrating(false)
  }, [projectId, currentProject, recentProjects, setProject, setSelectedItemId, navigate])

  // ── Derived state ──────────────────────────────────────────────────────────
  const activeSelectedItem =
    currentProject?.items.find((i) => i.id === selectedItemId) ?? null

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleBackToDashboard = () => {
    // Soft reset: clears workspace pointers without touching IndexedDB
    clearCache()
    navigate('/')
  }

  const handleSaveProject = async () => {
    setIsSaving(true)
    saveProject()
    setTimeout(() => setIsSaving(false), 800)
  }

  const handleAddNewItem = () => {
    const newItem: Item = {
      id:   crypto.randomUUID(),
      guid: crypto.randomUUID(),
      name: 'New Custom Item',
      description: 'Custom decorative mod asset configuration.',
      price: 5,
      tags: ['Decorative'],
      thumbnailKey: null,
      textureKeys: {},
      componentBlueprints: { rootDefaultStates: [], materialSurfaces: [] },
      components: [],
    }
    addItemWith(newItem)
  }

  const handleDeleteItem = (itemId: string) => {
    deleteItem(itemId)
  }

  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id)
  }

  return {
    // State
    currentProject,
    selectedItemId,
    activeSelectedItem,
    isSaving,
    isRehydrating,

    // Project-level mutations (passed directly to header inputs)
    updateProject,

    // Item-level handlers
    handleAddNewItem,
    handleDeleteItem,
    handleSelectItem,
    updateItem,

    // Project-level handlers
    handleSaveProject,
    handleBackToDashboard,
  }
}
