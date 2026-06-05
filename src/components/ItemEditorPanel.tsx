import React from 'react'
import type { Item } from '../types'

interface ItemEditorPanelProps {
  item: Item | null | undefined
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPriceChange: (value: number) => void
  onTagsChange: (value: string[]) => void
}

export default function ItemEditorPanel({
  item,
  onNameChange,
  onDescriptionChange,
  onPriceChange,
  onTagsChange,
}: ItemEditorPanelProps) {
  return (
    <div className="split-right">
      {!item ? (
        <div className="editor-empty">Select an item to edit</div>
      ) : (
        <div className="editor-form">
          <div className="editor-field">
            <label>Item Name</label>
            <input
              type="text"
              value={item.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter item name"
            />
          </div>

          <div className="editor-field">
            <label>Description</label>
            <textarea
              value={item.description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Enter item description"
              rows={4}
            />
          </div>

          <div className="editor-field">
            <label>Price ($)</label>
            <input
              type="number"
              value={item.price}
              onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>

          <div className="editor-field">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={item.tags.join(', ')}
              onChange={(e) => {
                const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                onTagsChange(tags)
              }}
              placeholder="tag1, tag2, tag3"
            />
          </div>
        </div>
      )}
    </div>
  )
}
