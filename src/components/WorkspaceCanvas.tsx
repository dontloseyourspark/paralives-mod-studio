// src/components/WorkspaceCanvas.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
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
  onDeselectItem: () => void
  onSelectNode: (node: ComponentNode) => void
  onAddItem: () => void
  onClearNode: () => void
  onAddChildNode: (item: Item) => void
  onRemoveChildNode: (item: Item, nodeGuid: string) => void
  onDeleteItem: (itemId: string) => void
  onSaveItem: (updatedItem: Item) => void
  onWizardAdvancedEditing: (partial: Partial<Item> | TranslationWizardPayload) => void
  onProjectChange: (updated: ModProject) => void
}

const MIN_EDITOR_WIDTH = 320
const MIN_VIEWPORT_WIDTH = 200

export default function WorkspaceCanvas({
  project,
  items,
  selectedItemId,
  selectedNodeKey,
  activeSelectedItem,
  activeSelectedNode,
  onSelectItem,
  onDeselectItem,
  onSelectNode,
  onAddItem,
  onClearNode,
  onAddChildNode,
  onRemoveChildNode,
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
  const showViewport = showItemsPanel

  const coverThumbnailUrl = project?.coverThumbnailKey
    ? stringUrlCache[project.coverThumbnailKey] ?? localStorage.getItem(`asset_fallback_${project.coverThumbnailKey}`)
    : null

  const [measuredOversized, setMeasuredOversized] = useState(false)
  useEffect(() => {
    if (!coverThumbnailUrl) return
    let cancelled = false
    const img = new Image()
    img.onload = () => { if (!cancelled) setMeasuredOversized(img.naturalWidth !== 1020 || img.naturalHeight !== 1020) }
    img.onerror = () => { if (!cancelled) setMeasuredOversized(false) }
    img.src = coverThumbnailUrl
    return () => { cancelled = true }
  }, [coverThumbnailUrl])
  const coverThumbnailWarning = !!coverThumbnailUrl && measuredOversized

  const handleCoverUpload = (file: File) => {
    if (!project) return
    const key = `cover_${project.id}`
    registerFileInCache(key, file)
    onProjectChange({ ...project, coverThumbnailKey: key })
  }

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newViewportWidth = containerRect.right - ev.clientX
      setViewportWidth(Math.max(MIN_VIEWPORT_WIDTH, Math.min(newViewportWidth, containerRect.width - MIN_EDITOR_WIDTH)))
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
    <div className="flex-1 flex flex-col min-h-0">
    <div className="flex-1 flex min-h-0 relative">

      {showItemsPanel && (
        <div className="relative h-full flex flex-col shrink-0">
          <ItemsPanel
            items={items}
            selectedItemId={selectedItemId}
            selectedNodeKey={selectedNodeKey}
            onSelectItem={onSelectItem}
            onDeselectItem={onDeselectItem}
            onSelectNode={onSelectNode}
            onAddItem={onAddItem}
            onAddChildNode={onAddChildNode}
            onRemoveChildNode={onRemoveChildNode}
            coverThumbnailUrl={coverThumbnailUrl}
            coverThumbnailWarning={coverThumbnailWarning}
            onCoverUpload={handleCoverUpload}
          />

        </div>
      )}

      <div ref={containerRef} className="flex-1 flex h-full min-w-0">
        <main className="flex-1 h-full min-w-0 bg-[#0e1017] overflow-hidden">
          {showTranslationEditor ? (
            <TranslationEditorPanel />
          ) : (
            <ItemEditorPanel
              key={activeSelectedItem?.id}
              item={activeSelectedItem}
              activeNode={activeSelectedNode}
              onSave={onSaveItem}
              onDeleteItem={onDeleteItem}
              onRemoveChildNode={onRemoveChildNode}
              onClearNode={onClearNode}
            />
          )}
        </main>

        {showViewport && (
          <>
            <div
              onMouseDown={handleDividerMouseDown}
              className="w-1 h-full bg-white/5 hover:bg-[#8b5cf6]/40 active:bg-[#8b5cf6]/60 cursor-col-resize transition-colors shrink-0 select-none"
              title="Drag to resize"
            />
            <div className="h-full shrink-0 overflow-hidden" style={{ width: viewportWidth }}>
              <MeshViewport
                meshKeys={activeSelectedItem?.meshKeys ?? {}}
                activeNode={activeSelectedNode}
                item={activeSelectedItem}
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

    {/* ── Status bar ── */}
    <div className="h-7 shrink-0 bg-[#0e1017] border-t border-white/5 flex items-center px-4 gap-2 select-none">
      <span className="text-[10px] text-gray-600 font-mono">Paralives Mod Studio v{__APP_VERSION__}</span>
      {project && (
        <>
          <span className="text-gray-700 text-[10px]">•</span>
          <span className="text-[10px] text-gray-500 font-medium truncate">{project.name}</span>
          <span className="text-gray-700 text-[10px]">·</span>
          <span className="text-[10px] text-gray-600">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
        </>
      )}
    </div>
    </div>
  )
}

