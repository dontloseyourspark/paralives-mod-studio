import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import type { Item, ComponentNode } from '../types/types'
import type { TranslationWizardPayload } from '../components/CreateModWizard'
import { getMeshNodes } from '../lib/itemTextureSlots'

/**
 * All workspace logic for the project editor screen.
 *
 * Persistence strategy:
 *   currentProject and selectedItemId are persisted directly to localStorage
 *   by the store, so on page refresh they're available immediately after the
 *   Zustand persist middleware finishes loading (Phase 1 of App.tsx boot).
 *   No lookup through recentProjects is needed.
 *
 * Node selection (selectedNodeId) is session-only — not persisted.
 * It resets to the root ItemMeshReference node whenever the selected item changes.
 */
export function useProjectWorkspace() {
  const navigate = useNavigate()
  const { id: projectId } = useParams<{ id: string }>()

  // ── Zustand persist hydration gate ────────────────────────────────────────
  const [storeReady, setStoreReady] = useState(false)

  useEffect(() => {
    if (useModStore.persist.hasHydrated()) {
      const t = setTimeout(() => setStoreReady(true), 0)
      return () => clearTimeout(t)
    }
    const unsub = useModStore.persist.onFinishHydration(() => setStoreReady(true))
    const fallback = setTimeout(() => setStoreReady(true), 300)
    return () => {
      unsub()
      clearTimeout(fallback)
    }
  }, [])

  useEffect(() => {
    if (storeReady) return
    const unsub = useModStore.persist.onFinishHydration(() => setStoreReady(true))
    return unsub
  }, [storeReady])

  // ── Store reads ────────────────────────────────────────────────────────────
  const currentProject = useModStore((s) => s.currentProject)
  const recentProjects = useModStore((s) => s.recentProjects)
  const selectedItemId = useModStore((s) => s.selectedItemId)

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
  useEffect(() => {
    if (!storeReady) return

    if (!currentProject) {
      if (projectId && recentProjects.length > 0) {
        const match = recentProjects.find((p) => p.id === projectId)
        if (match) {
          setProject(match)
          if (match.items?.length > 0) setSelectedItemId(match.items[0].id)
          return
        }
      }
      console.warn('[useProjectWorkspace] No project to restore, redirecting home.')
      navigate('/')
      return
    }

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

  // ── Derived item state ─────────────────────────────────────────────────────
  const activeSelectedItem =
    currentProject?.items.find((i) => i.id === selectedItemId) ?? null

  // ── Node selection (session-only, not persisted) ───────────────────────────
  // Tracks which ComponentNode (by composite key id+type) is active in the left
  // panel accordion. A manual pick (handleSelectNode) is tagged with the item id
  // it belongs to; selectedNodeKey falls back to the item's root node whenever
  // that tag doesn't match the currently selected item (i.e. the item changed).
  // This is a pure per-render derivation — no setState call during render needed.
  const [nodeOverride, setNodeOverride] = useState<{ itemId: string | null; nodeKey: string } | null>(null)

  // Derive the root node key for a given item
  const getRootNodeKey = useCallback((item: Item | null): string | null => {
    if (!item) return null
    const meshNodes = getMeshNodes(item.components || [])
    const root = meshNodes.find(n => n.childIndex === undefined) ?? meshNodes[0]
    return root ? `${root.id}_${root.type}` : null
  }, [])

  const selectedNodeKey =
    nodeOverride && nodeOverride.itemId === selectedItemId
      ? nodeOverride.nodeKey
      : getRootNodeKey(activeSelectedItem)

  // Derive the active node from the key
  const activeSelectedNode: ComponentNode | null = (() => {
    if (!selectedNodeKey || !activeSelectedItem) return null
    return activeSelectedItem.components.find(
      c => `${c.id}_${c.type}` === selectedNodeKey
    ) ?? null
  })()

  // ── Action handlers ────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)

  const handleBackToDashboard = () => {
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

  const handleDeleteItem = (itemId: string) => deleteItem(itemId)

  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id)
    // Node falls back to the new item's root automatically — see selectedNodeKey derivation above
  }

  const handleSelectNode = useCallback((node: ComponentNode) => {
    setNodeOverride({ itemId: selectedItemId, nodeKey: `${node.id}_${node.type}` })
  }, [selectedItemId, setNodeOverride])

  const handleWizardAdvancedEditing = (partial: Partial<Item> | TranslationWizardPayload) => {
    if ('isTranslation' in partial) return
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
    selectedNodeKey,
    activeSelectedItem,
    activeSelectedNode,
    isSaving,
    isRehydrating,
    updateProject,
    handleAddNewItem,
    handleDeleteItem,
    handleSelectItem,
    handleSelectNode,
    handleWizardAdvancedEditing,
    updateItem,
    handleSaveProject,
    handleBackToDashboard,
  }
}