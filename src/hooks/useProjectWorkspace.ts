import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types/types'

/**
 * All workspace logic for the project editor screen.
 *
 * Persistence strategy:
 *   currentProject and selectedItemId are persisted directly to localStorage
 *   by the store, so on page refresh they're available immediately after the
 *   Zustand persist middleware finishes loading (Phase 1 of App.tsx boot).
 *   No lookup through recentProjects is needed.
 *
 * This hook only needs to:
 *   1. Wait for the persist middleware to finish (storeReady gate)
 *   2. Verify the URL projectId matches the restored currentProject
 *   3. Redirect to '/' if there's genuinely nothing to show
 */
export function useProjectWorkspace() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  // ── Zustand persist hydration gate ────────────────────────────────────────
  // Wait for localStorage restore to complete before acting on store state.
  const [storeReady, setStoreReady] = useState(
    () => useModStore.persist.hasHydrated()
  )

  useEffect(() => {
    if (storeReady) return
    const unsub = useModStore.persist.onFinishHydration(() => setStoreReady(true))
    return unsub
  }, [storeReady])

  // ── Store reads ────────────────────────────────────────────────────────────
  const currentProject  = useModStore((s) => s.currentProject)
  const recentProjects  = useModStore((s) => s.recentProjects)
  const selectedItemId  = useModStore((s) => s.selectedItemId)

  // ── Store mutations ────────────────────────────────────────────────────────
  const setProject            = useModStore((s) => s.setProject)
  const setSelectedItemId     = useModStore((s) => s.setSelectedItemId)
  const updateProject         = useModStore((s) => s.updateProject)
  const saveProject           = useModStore((s) => s.saveProject)
  const clearWorkspaceSession = useModStore((s) => s.clearWorkspaceSession)
  const addItemWith           = useModStore((s) => s.addItemWith)
  const updateItem            = useModStore((s) => s.updateItem)
  const deleteItem            = useModStore((s) => s.deleteItem)

  // ── Project validation after store is ready ────────────────────────────────
  // currentProject is persisted directly, so it's restored automatically.
  // We just need to handle the edge case where the URL id doesn't match
  // (e.g. user manually edited the URL, or navigated to a stale link).
  useEffect(() => {
    if (!storeReady) return

    if (!currentProject) {
      // Nothing persisted — try to recover from recentProjects by URL id
      if (projectId && recentProjects.length > 0) {
        const match = recentProjects.find((p) => p.id === projectId)
        if (match) {
          setProject(match)
          if (match.items?.length > 0) setSelectedItemId(match.items[0].id)
          return
        }
      }
      // Genuinely nothing found — redirect home
      console.warn('[useProjectWorkspace] No project to restore, redirecting home.')
      navigate('/')
      return
    }

    // Project is loaded — verify the URL id matches (catches stale URL edge case)
    if (projectId && currentProject.id !== projectId) {
      const match = recentProjects.find((p) => p.id === projectId)
      if (match) {
        setProject(match)
        if (match.items?.length > 0) setSelectedItemId(match.items[0].id)
      } else {
        console.warn('[useProjectWorkspace] URL projectId not found, redirecting home.')
        navigate('/')
      }
    }
  }, [storeReady, currentProject, projectId, recentProjects, setProject, setSelectedItemId, navigate])

  // ── Loading state ──────────────────────────────────────────────────────────
  const isRehydrating = !storeReady

  // ── Derived state ──────────────────────────────────────────────────────────
  const activeSelectedItem =
    currentProject?.items.find((i) => i.id === selectedItemId) ?? null

  // ── Action handlers ────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)

  const handleBackToDashboard = () => {
    // Clear the active session pointers — persisted recentProjects stays intact
    clearWorkspaceSession()
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

  const handleDeleteItem  = (itemId: string) => deleteItem(itemId)
  const handleSelectItem  = (item: Item) => setSelectedItemId(item.id)

  /**
   * Called when the user finishes the wizard via "Advanced editing".
   * Adds the partially-built item to the project and selects it so the
   * full editor opens immediately.
   */
  const handleWizardAdvancedEditing = (partial: Partial<Item>) => {
    const newItem: Item = {
      id:   partial.id   ?? crypto.randomUUID(),
      guid: partial.guid ?? crypto.randomUUID(),
      name: partial.name ?? 'New Mod Item',
      description: partial.description ?? '',
      price: partial.price ?? 0,
      tags:  partial.tags  ?? [],
      thumbnailKey: partial.thumbnailKey ?? null,
      textureKeys:  partial.textureKeys  ?? {},
      componentBlueprints: partial.componentBlueprints ?? { rootDefaultStates: [], materialSurfaces: [] },
      components: partial.components ?? [],
    }
    addItemWith(newItem)
  }

  return {
    currentProject,
    selectedItemId,
    activeSelectedItem,
    isSaving,
    isRehydrating,
    updateProject,
    handleAddNewItem,
    handleDeleteItem,
    handleSelectItem,
    handleWizardAdvancedEditing,
    updateItem,
    handleSaveProject,
    handleBackToDashboard,
  }
}
