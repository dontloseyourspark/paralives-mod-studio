import { useState } from 'react'
import { Plus, Trash } from 'phosphor-react'
import ItemsPanel from './ItemsPanel'
import ItemEditorPanel from './ItemEditorPanel'
import CreateModWizard from './CreateModWizard'
import type { Item } from '../types/types'

interface WorkspaceCanvasProps {
  items: Item[]
  selectedItemId: string | null
  activeSelectedItem: Item | null
  onSelectItem: (item: Item) => void
  onAddItem: () => void
  onDeleteItem: (itemId: string) => void
  onSaveItem: (updatedItem: Item) => void
  onWizardAdvancedEditing: (partial: Partial<Item>) => void
}

/**
 * The three-column production editing canvas for the project workspace.
 *
 * Responsibilities:
 *   - Left column: ItemsPanel (scrollable asset list + Add/Delete controls)
 *   - Main column: ItemEditorPanel (detail editor for the selected item)
 *   - Owns wizard open/close state only — all wizard data logic lives in
 *     useProjectWorkspace via the injected callbacks
 *
 * This component owns zero business logic beyond wizard visibility.
 * Changing layout, spacing, or colours here cannot affect state or item data.
 */
export default function WorkspaceCanvas({
  items,
  selectedItemId,
  activeSelectedItem,
  onSelectItem,
  onDeleteItem,
  onSaveItem,
  onWizardAdvancedEditing,
}: WorkspaceCanvasProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="flex-1 flex min-h-0 relative">

      {/* Left column: item list + Add/Delete controls */}
      <div className="relative h-full flex flex-col shrink-0">
        <ItemsPanel
          items={items}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />

        {/* Pinned bottom controls inside the sidebar */}
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

      {/* Main column: item detail editor */}
      <main className="flex-1 h-full min-w-0 bg-[#0e1017]">
        <ItemEditorPanel
          key={activeSelectedItem?.id}
          item={activeSelectedItem}
          onSave={onSaveItem}
        />
      </main>

      {/* New mod wizard */}
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
