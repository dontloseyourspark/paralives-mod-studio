import React from 'react'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types/types'

interface ItemsPanelProps {
  items: Item[]
  selectedItemId: string | null
  // Ensure the callback is explicitly typed in your interface contract
  onSelectItem: (item: Item) => void
}

export default function ItemsPanel({ items, selectedItemId, onSelectItem }: ItemsPanelProps) {
  const getBlobUrlFromCache = useModStore((state) => state.getBlobUrlFromCache)

  return (
    <div className="w-64 h-full bg-[#161923] border-r border-white/5 flex flex-col select-none box-border">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/5 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 m-0">
          Mod Asset Catalog
        </h3>
      </div>

      {/* Scrollable Items Container List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
        {(!items || items.length === 0) ? (
          <div className="text-xs text-gray-600 text-center py-8 italic">
            No items inside package manifest
          </div>
        ) : (
          items.map((item) => {
            const isSelected = item.id === selectedItemId
            // Dynamic secure resolution of binary file URLs from global cache
            const liveThumbnailUrl = getBlobUrlFromCache(item.thumbnailKey ?? null)

            return (
              <div
                key={item.id}
                onClick={() => {
                  // Defensive guard check: Only execute if the callback function is defined
                  if (typeof onSelectItem === 'function') {
                    onSelectItem(item)
                  } else {
                    console.warn("Warning: onSelectItem prop was not provided to ItemsPanel.")
                  }
                }}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150 cursor-pointer group border ${
                  isSelected
                    ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-white'
                    : 'bg-transparent border-transparent text-gray-400 hover:bg-white/2 hover:text-gray-200'
                }`}
              >
                {/* Visual Thumbnail Preview Rounded Frame */}
                <div className="w-9 h-9 shrink-0 bg-[#0e1017] border border-white/5 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                  {liveThumbnailUrl ? (
                    <img 
                      src={liveThumbnailUrl} 
                      alt={item.name} 
                      className="w-full h-full object-contain p-1 transform group-hover:scale-105 transition-transform duration-150" 
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-600 uppercase font-mono">
                      {(item.name || 'UN').substring(0, 2)}
                    </span>
                  )}
                </div>

                {/* Meta Information Label Stack */}
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                    {item.name || 'Untitled Object'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                    ${item.price ?? 0}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}