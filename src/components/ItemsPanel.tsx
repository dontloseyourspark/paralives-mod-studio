// src/components/ItemsPanel.tsx
import React, { useRef, useState } from 'react'
import { Image } from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types/types'

interface ItemsPanelProps {
  items: Item[]
  selectedItemId: string | null
  onSelectItem: (item: Item) => void
  coverThumbnailUrl: string | null
  onCoverUpload: (file: File) => void
}

export default function ItemsPanel({
  items,
  selectedItemId,
  onSelectItem,
  coverThumbnailUrl,
  onCoverUpload,
}: ItemsPanelProps) {
  const getBlobUrlFromCache = useModStore((state) => state.getBlobUrlFromCache)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onCoverUpload(file)
  }

  return (
    <div className="w-64 h-full bg-[#161923] border-r border-white/5 flex flex-col select-none box-border">

      {/* Cover thumbnail banner */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onCoverUpload(file)
          e.target.value = ''
        }}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        title={coverThumbnailUrl ? 'Replace mod cover thumbnail' : 'Upload mod cover thumbnail (1020×1020 PNG recommended)'}
        className="w-full h-32 shrink-0 relative overflow-hidden cursor-pointer group border-b border-white/5"
      >
        {coverThumbnailUrl ? (
          <>
            <img src={coverThumbnailUrl} alt="Mod cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity">
              <Image size={16} className="text-white" weight="light" />
              <span className="text-white text-[10px] font-semibold tracking-wide">Change Cover</span>
            </div>
          </>
        ) : (
          <div className={`absolute inset-2 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
            dragging
              ? 'border-[#8b5cf6]/60 bg-[#8b5cf6]/5'
              : 'border-white/10 group-hover:border-white/20'
          }`}>
            <Image size={20} weight="light" className={`transition-colors ${dragging ? 'text-[#a78bfa]' : 'text-gray-500 group-hover:text-gray-400'}`} />
            <span className={`text-[10px] font-medium text-center leading-tight px-3 transition-colors ${dragging ? 'text-[#a78bfa]' : 'text-gray-500 group-hover:text-gray-400'}`}>
              {dragging ? 'Drop to set cover' : 'Click or drop\nto add cover'}
            </span>
          </div>
        )}
      </div>

      {/* Sidebar header */}
      <div className="p-4 border-b border-white/5 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 m-0">
          Mod Assets
        </h3>
      </div>

      {/* Scrollable items list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
        {(!items || items.length === 0) ? (
          <div className="text-xs text-gray-600 text-center py-8 italic">
            No items inside package manifest
          </div>
        ) : (
          items.map((item) => {
            const isSelected = item.id === selectedItemId
            const liveThumbnailUrl = getBlobUrlFromCache(item.thumbnailKey ?? null)

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (typeof onSelectItem === 'function') {
                    onSelectItem(item)
                  } else {
                    console.warn('Warning: onSelectItem prop was not provided to ItemsPanel.')
                  }
                }}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150 cursor-pointer group border ${
                  isSelected
                    ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-white'
                    : 'bg-transparent border-transparent text-gray-400 hover:bg-white/2 hover:text-gray-200'
                }`}
              >
                {/* Thumbnail */}
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

                {/* Name + price */}
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
