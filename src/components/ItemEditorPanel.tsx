import { Square, CheckSquare } from 'phosphor-react'
import type { Item } from '../types/types'

interface ItemEditorPanelProps {
  item: Item | undefined
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPriceChange: (value: number) => void
  onTagsChange: (value: string[]) => void
}

// Available tags for the checkbox selection grid
const AVAILABLE_TAGS = ['Furniture', 'Clothing', 'Script', 'Build Mode', 'Wallpaper', 'Flooring']

export default function ItemEditorPanel({
  item,
  onNameChange,
  onDescriptionChange,
  onPriceChange,
  onTagsChange,
}: ItemEditorPanelProps) {
  // If no item is selected from the sidebar list, render a clean empty slate message
  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm font-medium select-none text-center p-8">
        Select an item from the list to start editing its attributes.
      </div>
    )
  }

  const handleTagToggle = (tag: string) => {
    const currentTags = item.tags || []
    if (currentTags.includes(tag)) {
      onTagsChange(currentTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...currentTags, tag])
    }
  }

  return (
    <div className="flex flex-col gap-8 py-10 px-8 max-w-[700px] mx-auto w-full box-border animate-in fade-in duration-200">
      <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
        
        {/* Field: Name */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 select-none">
            Item Name <span className="text-[#8b5cf6] ml-0.5">*</span>
          </label>
          <input
            type="text"
            className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/5 transition-all duration-150"
            value={item.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Cozy Wooden Chair"
            required
          />
        </div>

        {/* Field: Price */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 select-none">
            Price <span className="text-[#8b5cf6] ml-0.5">*</span>
          </label>
          <div className="relative flex items-center w-full">
            <span className="absolute left-4 text-sm font-medium text-gray-500 pointer-events-none select-none">
              $
            </span>
            <input
              type="number"
              className="w-full bg-white/3 border border-white/5 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/5 transition-all duration-150"
              value={item.price || 0}
              onChange={(e) => onPriceChange(Number(e.target.value))}
              placeholder="0.00"
              min="0"
              step="any"
              required
            />
          </div>
        </div>

        {/* Field: Description */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 select-none">
            Description
          </label>
          <textarea
            className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/5 transition-all duration-150 min-h-[120px] resize-vertical leading-relaxed"
            value={item.description || ''}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe your custom mod item..."
          />
        </div>

        {/* Field: Tags Selection Grid */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 select-none">
            Tags / Categories
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AVAILABLE_TAGS.map((tag) => {
              const isChecked = (item.tags || []).includes(tag)
              return (
                <div
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border cursor-pointer select-none transition-all duration-150 ${
                    isChecked
                      ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-white'
                      : 'bg-white/2 border-white/2 text-gray-400 hover:bg-white/4 hover:border-white/5'
                  }`}
                >
                  <div className="shrink-0 flex items-center justify-center">
                    {isChecked ? (
                      <CheckSquare size={18} weight="fill" className="text-[#8b5cf6]" />
                    ) : (
                      <Square size={18} className="text-gray-600" />
                    )}
                  </div>
                  <span className="text-xs font-medium tracking-wide">
                    {tag}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </form>
    </div>
  )
}