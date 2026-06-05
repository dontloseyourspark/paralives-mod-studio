import { useState, useEffect, useRef } from 'react'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types'
import { X } from 'phosphor-react'
import '../styles/Dashboard.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  item?: Item | null
}

export default function CreateItemModal({ isOpen, onClose, item }: Props) {
  const addItemWith = useModStore((s) => s.addItemWith)
  const updateItem = useModStore((s) => s.updateItem)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number>(0)
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (item) {
      setName(item.name || '')
      setDescription(item.description || '')
      setPrice(item.price || 0)
    } else {
      setName('')
      setDescription('')
      setPrice(0)
    }
    if (isOpen) {
      setTimeout(() => {
        nameRef.current?.focus()
      }, 60)
    }
  }, [item, isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    if (item) {
      updateItem(item.id, { name, description, price })
    } else {
      addItemWith({ name: name || 'New Item', description, price })
    }
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>{item ? 'Edit Item' : 'Create New Item'}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>
        <p className="modal-sub">{item ? 'Edit item details.' : 'Add a new item to your mod.'}</p>

        <div className="modal-body">
          <label>Item Name *</label>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter item name" />

          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the item..." />

          <label>Price ($)</label>
          <input type="number" value={String(price)} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>{item ? 'Save' : 'Create Item'}</button>
        </div>
      </div>
    </div>
  )
}
