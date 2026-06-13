import { useState } from 'react'
import { Plus, Trash } from 'phosphor-react'
import ItemsPanel from './ItemsPanel'
import ItemEditorPanel from './ItemEditorPanel'
import CreateModWizard, { type TranslationWizardPayload } from './CreateModWizard'
import TranslationEditorPanel from './TranslationEditorPanel'
import type { Item, ModProject } from '../types/types'

interface WorkspaceCanvasProps {
  project?: ModProject // Added to read translation metadata
  items: Item[]
  selectedItemId: string | null
  activeSelectedItem: Item | null
  onSelectItem: (item: Item) => void
  onAddItem: () => void
  onDeleteItem: (itemId: string) => void
  onSaveItem: (updatedItem: Item) => void
  onWizardAdvancedEditing: (partial: Partial<Item> | TranslationWizardPayload) => void
}

export default function WorkspaceCanvas({
  project,
  items,
  selectedItemId,
  activeSelectedItem,
  onSelectItem,
  onDeleteItem,
  onSaveItem,
  onWizardAdvancedEditing,
}: WorkspaceCanvasProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  const hasTranslations = project?.translations && project.translations.length > 0
  const isPureTranslationMod = hasTranslations && items.length === 0

  return (
    <div className="flex-1 flex min-h-0 relative">

      {/* Conditionally hide the 3D items sidebar if this is strictly a translation mod */}
      {!isPureTranslationMod && (
        <div className="relative h-full flex flex-col shrink-0">
          <ItemsPanel
            items={items}
            selectedItemId={selectedItemId}
            onSelectItem={onSelectItem}
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

      {/* Main column */}
      <main className="flex-1 h-full min-w-0 bg-[#0e1017]">
        {hasTranslations ? (
          <TranslationEditorPanel />
        ) : (
          <ItemEditorPanel
            key={activeSelectedItem?.id}
            item={activeSelectedItem}
            onSave={onSaveItem}
          />
        )}
      </main>

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