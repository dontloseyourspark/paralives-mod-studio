// src/components/TranslationLeftPanel.tsx
import React from 'react'

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
}

export default function TranslationLeftPanel({ categories, activeCategoryId, onSelect }: TranslationLeftPanelProps) {
  return (
    <div className="w-52 shrink-0 h-full bg-[#161923] border-r border-white/5 flex flex-col select-none">
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
