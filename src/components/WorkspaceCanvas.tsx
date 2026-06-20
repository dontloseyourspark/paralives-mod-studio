// src/components/WorkspaceCanvas.tsx
import { useState, useRef, useCallback } from 'react'
import { Plus, Trash } from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import ItemsPanel from './ItemsPanel'
import ItemEditorPanel from './ItemEditorPanel'
import MeshViewport from './MeshViewport'
import CreateModWizard, { type TranslationWizardPayload } from './CreateModWizard'
import TranslationEditorPanel from './TranslationEditorPanel'
import type { Item, ModProject, ComponentNode } from '../types/types'

interface WorkspaceCanvasProps {
  project?: ModProject
  items: Item[]
  selectedItemId: string | null
  selectedNodeKey: string | null
  activeSelectedItem: Item | null
  activeSelectedNode: ComponentNode | null
  onSelectItem: (item: Item) => void
  onSelectNode: (node: ComponentNode) => void
  onAddItem: () => void
  onDeleteItem: (itemId: string) => void
  onSaveItem: (updatedItem: Item) => void
  onWizardAdvancedEditing: (partial: Partial<Item> | TranslationWizardPayload) => void
  onProjectChange: (updated: ModProject) => void
}

const MIN_EDITOR_WIDTH = 320   // px — editor panel minimum
const MIN_VIEWPORT_WIDTH = 200 // px — viewport minimum

export default function WorkspaceCanvas({
  project,
  items,
  selectedItemId,
  selectedNodeKey,
  activeSelectedItem,
  activeSelectedNode,
  onSelectItem,
  onSelectNode,
  onDeleteItem,
  onSaveItem,
  onWizardAdvancedEditing,
  onProjectChange,
}: WorkspaceCanvasProps) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() =>
    Math.max(MIN_VIEWPORT_WIDTH, Math.floor(window.innerWidth * 0.60))
  )
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const registerFileInCache = useModStore((s) => s.registerFileInCache)
  const stringUrlCache = useModStore((s) => s.stringUrlCache)

  const modType = project?.modType ?? (items.length > 0 ? 'item' : 'translation')
  const showItemsPanel = modType === 'item' || modType === 'surface'
  const showTranslationEditor = modType === 'translation'
  const showViewport = showItemsPanel  // 3D viewport only for item mods

  const coverThumbnailUrl = project?.coverThumbnailKey
    ? stringUrlCache[project.coverThumbnailKey] ?? localStorage.getItem(`asset_fallback_${project.coverThumbnailKey}`)
    : null

  const handleCoverUpload = (file: File) => {
    if (!project) return
    const key = `cover_${project.id}`
    registerFileInCache(key, file)
    onProjectChange({ ...project, coverThumbnailKey: key })
  }

  // ── Resizable divider ──────────────────────────────────────────────────────
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      // Viewport width = distance from right edge of container to mouse
      const newViewportWidth = containerRect.right - ev.clientX
      setViewportWidth(Math.max(MIN_VIEWPORT_WIDTH, Math.min(
        newViewportWidth,
        containerRect.width - MIN_EDITOR_WIDTH
      )))
    }

    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div className="flex-1 flex min-h-0 relative">

      {/* ── Items sidebar ── */}
      {showItemsPanel && (
        <div className="relative h-full flex flex-col shrink-0">
          <ItemsPanel
            items={items}
            selectedItemId={selectedItemId}
            selectedNodeKey={selectedNodeKey}
            onSelectItem={onSelectItem}
            onSelectNode={onSelectNode}
            coverThumbnailUrl={coverThumbnailUrl}
            onCoverUpload={handleCoverUpload}
          />

          <div className="absolute bottom-3 left-3 right-3 flex gap-2 select-none">
            <button
              onClick={() => setWizardOpen(true)}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer text-gray-300 hover:text-white border border-white/5 transition-all outline-none"
            >
              <Plus size={12} weight="bold" className="text-[#8b5cf6]" />
              <span>Add Item</span>
            </button>

            {activeSelectedItem && (
              <button
                onClick={() => onDeleteItem(activeSelectedItem.id)}
                className="p-2 bg-rose-950/20 hover:bg-rose-950/60 text-rose-400 rounded-xl cursor-pointer border border-rose-500/10 hover:border-rose-500/30 transition-all outline-none"
                title="Delete selected item"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main area: editor + divider + viewport ── */}
      <div ref={containerRef} className="flex-1 flex h-full min-w-0">

        {/* Editor panel */}
        <main className="flex-1 h-full min-w-0 bg-[#0e1017] overflow-hidden">
          {showTranslationEditor ? (
            <TranslationEditorPanel />
          ) : (
            <ItemEditorPanel
              key={activeSelectedItem?.id}
              item={activeSelectedItem}
              activeNode={activeSelectedNode}
              onSave={onSaveItem}
            />
          )}
        </main>

        {/* Resizable divider + viewport — item mods only */}
        {showViewport && (
          <>
            {/* Drag handle */}
            <div
              onMouseDown={handleDividerMouseDown}
              className="w-1 h-full bg-white/5 hover:bg-[#8b5cf6]/40 active:bg-[#8b5cf6]/60 cursor-col-resize transition-colors shrink-0 select-none"
              title="Drag to resize"
            />

            {/* 3D Viewport */}
            <div
              className="h-full shrink-0 overflow-hidden"
              style={{ width: viewportWidth }}
            >
              <MeshViewport
                meshKeys={activeSelectedItem?.meshKeys ?? {}}
                activeNode={activeSelectedNode}
              />
            </div>
          </>
        )}
      </div>

      <CreateModWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onAdvancedEditing={(partial) => {
          setWizardOpen(false)
          onWizardAdvancedEditing(partial)
        }}
      />
    </div>
  )
}
