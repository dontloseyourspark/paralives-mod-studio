import { Plus, Trash } from 'phosphor-react'
import type { Item } from '../types'

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
    <div className="split-left">
      <div className="items-list-header">
        <h3>Items ({items.length})</h3>
        <button className="btn-add-item" onClick={onAddItem} aria-label="Add item">
          <Plus size={16} />
        </button>
      </div>
      <div className="items-list">
        {items.length === 0 ? (
          <div className="empty-state">No items yet. Click the + button to add one.</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`item-list-entry ${selectedItemId === item.id ? 'selected' : ''}`}
              onClick={() => onSelectItem(item.id)}
            >
              <div className="item-list-content">
                <div className="item-list-name">{item.name}</div>
                <div className="item-list-meta">${item.price.toFixed(2)}</div>
              </div>
              <button
                className="item-list-delete"
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
