import { useModStore } from '../store/useModStore'
import { PencilSimple, Trash, Plus } from 'phosphor-react'
import type { Item } from '../types'
import '../styles/ItemEditor.css'

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
    <div className="items-list">
      {!hideCreateButton && (
        <div className="create-row">
          <button className="btn-create-item" onClick={addItem}>
            <Plus size={14} />
            <span style={{ marginLeft: 8 }}>Create Item</span>
          </button>
        </div>
      )}

      <div className="items-grid">
        {project.items.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-card-main">
              <div>
                <h3>{item.name}</h3>
                <p className="item-description">Price: ${item.price}</p>
              </div>
              <div className="item-actions">
                <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => (onEdit ? onEdit(item) : null)}>
                  <PencilSimple size={16} weight="regular" />
                </button>
                <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => handleDelete(item.id)}>
                  <Trash size={16} weight="regular" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

