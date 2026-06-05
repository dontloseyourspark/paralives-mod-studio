import { useModStore } from '../store/useModStore'
import '../styles/ItemEditor.css'

export default function ItemEditor() {
  const project = useModStore((s) => s.currentProject)
  const addItem = useModStore((s) => s.addItem)

  if (!project) return null

  return (
    <div className="items-list">
      <button className="btn-create-item" onClick={addItem}>
        + Create Item
      </button>

      <div className="items-grid">
        {project.items.map((item) => (
          <div key={item.id} className="item-card">
            <h3>{item.name}</h3>
            <p className="item-description">{item.description}</p>
            <p className="item-price">Price: ${item.price}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

