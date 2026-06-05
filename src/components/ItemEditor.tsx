import { useModStore } from '../store/useModStore'
import { PencilSimple, Trash, Plus } from 'phosphor-react'
import type { Item } from '../types'

interface ItemEditorProps {
  hideCreateButton?: boolean
  onEdit?: (item: Item) => void
}

export default function ItemEditor({ hideCreateButton, onEdit }: ItemEditorProps) {
  const project = useModStore((s) => s.currentProject)
  const addItem = useModStore((s) => s.addItem)
  const deleteItem = useModStore((s) => s.deleteItem)

  if (!project) return null

  const handleDelete = (id: string) => {
    if (!confirm('Delete this item?')) return
    deleteItem(id)
  }

  return (
    <div className="w-full flex flex-col gap-4 p-6 box-border">
      {/* Create Button Row */}
      {!hideCreateButton && (
        <div className="flex justify-end select-none">
          <button 
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] rounded-xl transition-colors duration-150 border-none cursor-pointer shadow-sm" 
            onClick={addItem}
          >
            <Plus size={14} weight="bold" />
            <span>Create Item</span>
          </button>
        </div>
      )}

      {/* Grid of Item Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {project.items.map((item) => (
          <div 
            key={item.id} 
            className="bg-[#161923] border border-white/5 rounded-2xl p-4 flex flex-col justify-between min-h-[100px] transition-all duration-150 hover:border-white/10 group select-none"
          >
            <div className="flex justify-between items-start gap-4 w-full">
              {/* Text Meta Content */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate m-0">
                  {item.name || 'Untitled Item'}
                </h3>
                <p className="text-xs text-gray-500 m-0">
                  Price: ${item.price}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                <button 
                  className="bg-transparent border-none p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer flex items-center justify-center transition-colors focus:outline-none" 
                  title="Edit" 
                  aria-label="Edit" 
                  onClick={() => (onEdit ? onEdit(item) : null)}
                >
                  <PencilSimple size={16} />
                </button>
                <button 
                  className="bg-transparent border-none p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer flex items-center justify-center transition-colors focus:outline-none" 
                  title="Delete" 
                  aria-label="Delete" 
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}