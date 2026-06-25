import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import type { Item, ComponentNode, ModProject } from '../types/types'
import { makeDefaultItem } from '../types/types'
import type { TranslationWizardPayload } from '../components/CreateModWizard'
import { getMeshNodes } from '../lib/itemTextureSlots'
import { makeDefaultComponents } from '../lib/defaultComponents'

/**
 * All workspace logic for the project editor screen.
 *
 * Persistence strategy:
 *   currentProject and selectedItemId are persisted directly to localStorage
 *   by the store, so on page refresh they're available immediately after the
 *   Zustand persist middleware finishes loading (Phase 1 of App.tsx boot).
 *
 * Undo/redo: ref-based snapshot stacks (cap 50). Only updateItem and
 * updateProject push snapshots. add/delete/addChild/removeChild excluded
 * intentionally — structural changes are obvious and confusing to undo silently.
 */

const UNDO_STACK_MAX = 50

function makeNumericGuid(): string {
  return crypto.randomUUID()
    .replace(/-/g, '')
    .replace(/[a-f]/g, (c) => String(c.charCodeAt(0) - 87))
    .replace(/[^0-9]/g, '1')
    .substring(0, 19)
    .padEnd(19, '0')
}

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
    return () => { unsub(); clearTimeout(fallback) }
  }, [])

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
  const updateProjectRaw      = useModStore((s) => s.updateProject)
  const saveProject           = useModStore((s) => s.saveProject)
  const clearWorkspaceSession = useModStore((s) => s.clearWorkspaceSession)
  const addItemWith           = useModStore((s) => s.addItemWith)
  const updateItemRaw         = useModStore((s) => s.updateItem)
  const deleteItem            = useModStore((s) => s.deleteItem)

  // ── Project validation ────────────────────────────────────────────────────
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
        navigate('/')
      }
    }
  }, [storeReady, currentProject, projectId, recentProjects, setProject, setSelectedItemId, navigate])

  const isRehydrating = !storeReady

  // ── Derived item state ─────────────────────────────────────────────────────
  const activeSelectedItem =
    currentProject?.items.find((i) => i.id === selectedItemId) ?? null

  // ── Node selection ─────────────────────────────────────────────────────────
  // selectedNodeKey is null = Level 0 (item fields view)
  //                  key   = Level 1 (node Prefab/Textures view)
  //
  // Auto-selects root node ONLY when the selected item changes to a different
  // item. Manually clearing the node (handleClearNode) sets it to null and
  // the prevItemId ref prevents the effect from immediately re-selecting root.
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null)
  const prevItemIdRef = useRef<string | null>(null)

  const getRootNodeKey = useCallback((item: Item | null): string | null => {
    if (!item) return null
    const meshNodes = getMeshNodes(item.components || [])
    const root = meshNodes.find(n => n.childIndex === undefined) ?? meshNodes[0]
    return root ? `${root.id}_${root.type}` : null
  }, [])

  useEffect(() => {
    // Only auto-select root when item actually changes to a different item
    if (selectedItemId !== prevItemIdRef.current) {
      prevItemIdRef.current = selectedItemId
      setSelectedNodeKey(getRootNodeKey(activeSelectedItem))
    }
  }, [selectedItemId, activeSelectedItem, getRootNodeKey])

  // Clear node selection → returns to Level 0 (item fields view)
  const handleClearNode = useCallback(() => {
    setSelectedNodeKey(null)
  }, [])

  const activeSelectedNode: ComponentNode | null = (() => {
    if (!selectedNodeKey || !activeSelectedItem) return null
    return activeSelectedItem.components.find(
      c => `${c.id}_${c.type}` === selectedNodeKey
    ) ?? null
  })()

  // ── Undo / redo ────────────────────────────────────────────────────────────
  const undoStack = useRef<ModProject[]>([])
  const redoStack = useRef<ModProject[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncUndoState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }, [])

  const pushSnapshot = useCallback((snapshot: ModProject) => {
    undoStack.current.push(snapshot)
    if (undoStack.current.length > UNDO_STACK_MAX) undoStack.current.shift()
    redoStack.current = []
    syncUndoState()
  }, [syncUndoState])

  const clearUndoHistory = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    syncUndoState()
  }, [syncUndoState])

  useEffect(() => { clearUndoHistory() }, [currentProject?.id, clearUndoHistory])

  const handleUndo = useCallback(() => {
    const snapshot = undoStack.current.pop()
    if (!snapshot || !currentProject) return
    redoStack.current.push(currentProject)
    updateProjectRaw(snapshot)
    syncUndoState()
  }, [currentProject, updateProjectRaw, syncUndoState])

  const handleRedo = useCallback(() => {
    const snapshot = redoStack.current.pop()
    if (!snapshot || !currentProject) return
    undoStack.current.push(currentProject)
    updateProjectRaw(snapshot)
    syncUndoState()
  }, [currentProject, updateProjectRaw, syncUndoState])

  const updateItem = useCallback((updatedItem: Item) => {
    if (currentProject) pushSnapshot(currentProject)
    updateItemRaw(updatedItem)
  }, [currentProject, pushSnapshot, updateItemRaw])

  const updateProject = useCallback((updatedProject: ModProject) => {
    if (currentProject) pushSnapshot(currentProject)
    updateProjectRaw(updatedProject)
  }, [currentProject, pushSnapshot, updateProjectRaw])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); if (canUndo) handleUndo() }
      else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); if (canRedo) handleRedo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canUndo, canRedo, handleUndo, handleRedo])

  // ── Action handlers ────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)

  const hasUnsavedChanges = false  // stub — amber dot disabled until save tracking is wired

  const handleBackToDashboard = () => { clearWorkspaceSession(); navigate('/') }

  const handleSaveProject = async () => {
    setIsSaving(true)
    saveProject()
    setTimeout(() => setIsSaving(false), 800)
  }

  const handleAddNewItem = () => {
    const guid = makeNumericGuid()
    const components = makeDefaultComponents(guid, null, {})
    const newItem: Item = makeDefaultItem({
      id: crypto.randomUUID(),
      guid,
      name: 'New Custom Item',
      prefabGuid: guid.substring(0, 18) + '1',
      components,
    })
    addItemWith(newItem)
  }

  // Add a child item to an existing parent item.
  // Creates a new scaffolded Item with HideFromCatalog:false, adds it to the
  // project, and updates the parent's itemVariants to include both itself and
  // the child (base item must self-reference as a variant).
  const handleAddChildItem = useCallback((parentItem: Item) => {
    if (!currentProject) return

    const childGuid = makeNumericGuid()
    const childId   = crypto.randomUUID()

    // Next available childIndex — look at existing child components
    const existingChildIndices = (parentItem.components || [])
      .map(c => c.childIndex)
      .filter((i): i is number => i !== undefined)
    const nextChildIndex = existingChildIndices.length > 0
      ? Math.max(...existingChildIndices) + 1
      : 0

    // Build scaffold with childIndex set on all three components
    const rawComponents = makeDefaultComponents(childGuid, null, {})
    const components = rawComponents.map(c => ({ ...c, childIndex: nextChildIndex }))

    const childItem: Item = makeDefaultItem({
      id:   childId,
      guid: childGuid,
      name: `${parentItem.name} (Child ${nextChildIndex})`,
      prefabGuid: parentItem.prefabGuid,  // same prefab as parent
      hideFromCatalog: false,
      components,
    })

    // Update parent's itemVariants — self-reference + new child
    const selfVariant = { guid: crypto.randomUUID(), itemVariantGuid: parentItem.guid }
    const childVariant = { guid: crypto.randomUUID(), itemVariantGuid: childGuid }
    const existingVariants = parentItem.itemVariants ?? []
    // Keep existing variants, add self if not present, add child
    const hasSelf = existingVariants.some(v => v.itemVariantGuid === parentItem.guid)
    const updatedVariants = [
      ...(hasSelf ? existingVariants : [selfVariant, ...existingVariants]),
      childVariant,
    ]
    const updatedParent: Item = {
      ...parentItem,
      itemVariants: updatedVariants,
      variantGuids: updatedVariants.map(v => v.itemVariantGuid),
    }

    // Write both changes atomically via updateProject
    const updatedProject: ModProject = {
      ...currentProject,
      items: [
        ...currentProject.items.map(i => i.id === parentItem.id ? updatedParent : i),
        childItem,
      ],
      updatedAt: new Date().toISOString(),
    }
    updateProjectRaw(updatedProject)
    setSelectedItemId(childId)
  }, [currentProject, updateProjectRaw, setSelectedItemId])

  // Remove a child item from its parent.
  // Deletes the child Item, removes it from parent's itemVariants.
  // If only the self-reference remains after removal, clears itemVariants entirely.
  const handleRemoveChildItem = useCallback((parentItem: Item, childGuid: string) => {
    if (!currentProject) return

    const updatedVariants = (parentItem.itemVariants ?? [])
      .filter(v => v.itemVariantGuid !== childGuid)
    // If only self-reference left, clear variants entirely
    const onlySelf = updatedVariants.length === 1 &&
      updatedVariants[0].itemVariantGuid === parentItem.guid
    const finalVariants = onlySelf ? [] : updatedVariants

    const updatedParent: Item = {
      ...parentItem,
      itemVariants: finalVariants,
      variantGuids: finalVariants.length > 0
        ? finalVariants.map(v => v.itemVariantGuid)
        : undefined,
    }

    const updatedProject: ModProject = {
      ...currentProject,
      items: currentProject.items
        .filter(i => i.guid !== childGuid)
        .map(i => i.id === parentItem.id ? updatedParent : i),
      updatedAt: new Date().toISOString(),
    }
    updateProjectRaw(updatedProject)

    // If the removed child was selected, fall back to parent
    if (selectedItemId) {
      const removedItem = currentProject.items.find(i => i.guid === childGuid)
      if (removedItem && selectedItemId === removedItem.id) {
        setSelectedItemId(parentItem.id)
      }
    }
  }, [currentProject, updateProjectRaw, selectedItemId, setSelectedItemId])

  // Add a child node to an existing item's prefab graph.
  // Creates new ItemCubeTransform + ItemMeshReference components sharing a new
  // node GUID with the next available childIndex. The root's ItemObjectRoot
  // already has ItemMeshReferences:null as a placeholder — the serialiser
  // fills the registry at export time from all ItemMeshReference components.
  const handleAddChildNode = useCallback((item: Item) => {
    const existingChildIndices = (item.components || [])
      .map(c => c.childIndex)
      .filter((i): i is number => i !== undefined)
    const nextChildIndex = existingChildIndices.length > 0
      ? Math.max(...existingChildIndices) + 1
      : 0

    const childNodeGuid = makeNumericGuid()

    const newComponents = [
      ...item.components,
      {
        id: childNodeGuid,
        type: 'ItemCubeTransform',
        nodeName: 'Child',
        childIndex: nextChildIndex,
        surfaces: undefined,
        properties: {
          LocalPosition: [0, 0, 0],
          LocalRotation: [0, 0, 0],
          MinAnchor: [0.5, 0.5, 0.5],
          MaxAnchor: [0.5, 0.5, 0.5],
          Pivot: [0.5, 0.5, 0.5],
          Size: [1, 1, 1],
        },
      },
      {
        id: childNodeGuid,
        type: 'ItemMeshReference',
        nodeName: 'Child',
        childIndex: nextChildIndex,
        surfaces: undefined,
        properties: {},
      },
    ]

    updateItem({ ...item, components: newComponents })
  }, [updateItem])

  // Remove a child node from an item's prefab graph.
  // Removes all components sharing the given node GUID.
  const handleRemoveChildNode = useCallback((item: Item, nodeGuid: string) => {
    const newComponents = item.components.filter(c => c.id !== nodeGuid)
    updateItem({ ...item, components: newComponents })
  }, [updateItem])

  const handleDeleteItem = (itemId: string) => deleteItem(itemId)

  const handleSelectItem = (item: Item) => { setSelectedItemId(item.id) }

  const handleDeselectItem = useCallback(() => { setSelectedItemId(null) }, [setSelectedItemId])

  const handleSelectNode = useCallback((node: ComponentNode) => {
    setSelectedNodeKey(`${node.id}_${node.type}`)
  }, [])

  const handleWizardAdvancedEditing = (partial: Partial<Item> | TranslationWizardPayload) => {
    if ('isTranslation' in partial) return
    const newItem: Item = makeDefaultItem({
      id:   partial.id   ?? crypto.randomUUID(),
      guid: partial.guid ?? crypto.randomUUID(),
      name: partial.name ?? 'New Mod Item',
      description: partial.description ?? '',
      price: partial.price ?? 0,
      thumbnailKey: partial.thumbnailKey ?? null,
      textureKeys:  partial.textureKeys  ?? {},
      componentBlueprints: partial.componentBlueprints ?? { rootDefaultStates: [], materialSurfaces: [] },
      components: partial.components ?? [],
    })
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
    hasUnsavedChanges,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    updateProject,
    updateItem,
    handleAddNewItem,
    handleAddChildItem,
    handleAddChildNode,
    handleRemoveChildNode,
    handleRemoveChildItem,
    handleDeleteItem,
    handleSelectItem,
    handleDeselectItem,
    handleSelectNode,
    handleClearNode,
    handleWizardAdvancedEditing,
    handleSaveProject,
    handleBackToDashboard,
  }
}