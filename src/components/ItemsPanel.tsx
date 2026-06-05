import { Plus, Trash } from 'phosphor-react'
import type { Item } from '../types/types'

interface ItemsPanelProps {
  items: Item[]
  selectedItemId: string | null
  onSelectItem: (id: string | null) => void
  onAddItem: () => void
  onDeleteItem: (id: string) => void
}

export default function ItemsPanel({
  items,
  selectedItemId,
  onSelectItem,
  onAddItem,
  onDeleteItem,
}: ItemsPanelProps) {
  return (
    <div className="flex flex-col gap-3 w-full bg-[#161923] border border-white/5 rounded-2xl p-4">
      {/* Header section with count and Add Button */}
      <div className="flex justify-between items-center select-none">
        <h3 className="text-sm font-semibold text-white">
          Items <span className="text-xs text-gray-500 font-medium ml-1">({items.length} total)</span>
        </h3>
        <button 
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] rounded-xl transition-colors duration-150 border-none cursor-pointer" 
          onClick={onAddItem} 
          aria-label="Add item"
        >
          <Plus size={14} weight="bold" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Items list body */}
      <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-6 px-4 bg-white/2 rounded-xl border border-dashed border-white/5 leading-relaxed">
            No items yet. Click the Add Item button to create one.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`group flex justify-between items-center px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                selectedItemId === item.id 
                  ? 'bg-white/5 border-white/10 shadow-sm' 
                  : 'bg-transparent border-white/2 hover:bg-white/2 hover:border-white/5'
              }`}
              onClick={() => onSelectItem(item.id)}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className={`text-sm font-medium truncate ${
                  selectedItemId === item.id ? 'text-white' : 'text-gray-300'
                }`}>
                  {item.name || 'Untitled Item'}
                </div>
                <div className="text-xs text-gray-500">
                  Price: ${item.price}
                </div>
              </div>
              
              <button
                className="bg-transparent border-none p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteItem(item.id)
                }}
                aria-label="Delete item"
              >
                <Trash size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}