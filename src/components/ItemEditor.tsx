import { useState } from 'react'
import { useModStore } from '../store/useModStore'
import '../styles/ItemEditor.css'

export default function ItemEditor() {
  const project = useModStore((s) => s.currentProject)
  const addItem = useModStore((s) => s.addItem)
  const updateItem = useModStore((s) => s.updateItem)
  const deleteItem = useModStore((s) => s.deleteItem)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', price: 0 })

  if (!project) return null

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setForm({ name: item.name, description: item.description, price: item.price })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm({ name: '', description: '', price: 0 })
  }

  const saveEdit = (id: string) => {
    updateItem(id, { name: form.name, description: form.description, price: form.price })
    cancelEdit()
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this item?')) return
    deleteItem(id)
  }

  return (
    <div className="items-list">
      <button className="btn-create-item" onClick={addItem}>
        + Create Item
      </button>

      <div className="items-grid">
        {project.items.map((item) => (
          <div key={item.id} className="item-card">
            {editingId === item.id ? (
              <div className="item-edit-form">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                />
                <input
                  type="number"
                  value={String(form.price)}
                  onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                />
                <div className="item-edit-actions">
                  <button onClick={() => saveEdit(item.id)}>Save</button>
                  <button onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h3>{item.name}</h3>
                <p className="item-description">{item.description}</p>
                <p className="item-price">Price: ${item.price}</p>
                <div className="item-actions">
                  <button onClick={() => startEdit(item)}>Edit</button>
                  <button onClick={() => handleDelete(item.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

