// src/components/TranslationLeftPanel.tsx
import React, { useRef, useState } from 'react'
import { Image, WarningCircle } from 'phosphor-react'

export interface CategoryStat {
  id: string
  label: string
  total: number
  completed: number
}

interface TranslationLeftPanelProps {
  categories: CategoryStat[]
  activeCategoryId: string
  onSelect: (id: string) => void
  thumbnailUrl: string | null
  thumbnailWarning: boolean
  onThumbnailUpload: (file: File) => void
}

export default function TranslationLeftPanel({ categories, activeCategoryId, onSelect, thumbnailUrl, thumbnailWarning, onThumbnailUpload }: TranslationLeftPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onThumbnailUpload(file)
  }

  return (
    <div className="w-52 shrink-0 h-full bg-[#161923] border-r border-white/5 flex flex-col select-none">

      {/* Cover thumbnail */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onThumbnailUpload(file)
          e.target.value = ''
        }}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        title={
          thumbnailWarning
            ? 'Thumbnail should be exactly 1020×1020 px — click to replace'
            : thumbnailUrl
              ? 'Replace mod cover thumbnail'
              : 'Upload mod cover thumbnail (1020×1020 PNG recommended)'
        }
        className="w-full h-32 shrink-0 relative overflow-visible cursor-pointer group border-b border-white/5"
      >
        {/* Clip inner content separately so the badge can escape */}
        <div className="absolute inset-0 overflow-hidden">
          {thumbnailUrl ? (
            <>
              <img src={thumbnailUrl} alt="Mod cover" className="w-full h-full object-cover" />
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity ${
                thumbnailWarning ? 'bg-amber-900/60' : 'bg-black/60'
              }`}>
                <Image size={16} className="text-white" weight="light" />
                <span className="text-white text-[10px] font-semibold tracking-wide">
                  {thumbnailWarning ? 'Fix Size (1020×1020)' : 'Change Cover'}
                </span>
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

        {/* Warning badge — escapes the clip */}
        {thumbnailWarning && (
          <span className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
            <WarningCircle size={16} weight="fill" className="text-amber-400 drop-shadow-sm" />
          </span>
        )}
      </div>

      <div className="px-4 py-3.5 border-b border-white/5 shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Categories</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {categories.map((cat) => {
          const isActive = cat.id === activeCategoryId
          const isEmpty = cat.total === 0
          const pct = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0
          const isComplete = pct === 100 && cat.total > 0

          return (
            <button
              key={cat.id}
              onClick={() => !isEmpty && onSelect(cat.id)}
              disabled={isEmpty}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all outline-none border ${
                isEmpty
                  ? 'opacity-25 cursor-not-allowed border-transparent'
                  : isActive
                  ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/25'
                  : 'border-transparent hover:bg-white/5 hover:border-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[11px] font-medium leading-tight ${isActive ? 'text-white' : 'text-gray-400'}`}>
                  {cat.label}
                </span>
                <span className={`text-[10px] font-mono tabular-nums shrink-0 ${
                  isComplete ? 'text-emerald-400' : isActive ? 'text-[#a78bfa]' : 'text-gray-600'
                }`}>
                  {cat.completed}/{cat.total}
                </span>
              </div>
              {!isEmpty && (
                <div className="h-[2px] bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isComplete ? 'bg-emerald-500' : isActive ? 'bg-[#8b5cf6]' : 'bg-white/15'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
