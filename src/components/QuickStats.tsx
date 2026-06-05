import React from 'react'

interface QuickStatsProps {
  totalItems: number
  version: string
  author: string
  lastModified: string
  onVersionChange: (value: string) => void
  onAuthorChange: (value: string) => void
}

export default function QuickStats({
  totalItems,
  version,
  author,
  lastModified,
  onVersionChange,
  onAuthorChange,
}: QuickStatsProps) {
  return (
    <div className="bg-[#161923] border border-white/5 rounded-2xl p-4 flex flex-col gap-1.5 select-none w-full box-border">
      {/* Card Header */}
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
        Quick Stats
      </h4>

      {/* Row: Total Items */}
      <div className="flex justify-between items-center py-2 border-b border-white/2 text-sm text-gray-300">
        <span>Total Items</span>
        <span className="bg-[#8b5cf6] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-5 text-center shadow-sm">
          {totalItems}
        </span>
      </div>

      {/* Row: Version Inline Input */}
      <div className="flex justify-between items-center py-1.5 border-b border-white/2 text-sm text-gray-300 group">
        <span className="shrink-0">Version</span>
        <input
          type="text"
          className="bg-transparent border-none outline-none text-right text-white font-semibold text-sm p-0 w-32 focus:outline-none focus:text-[#8b5cf6] transition-colors placeholder-gray-600"
          value={version}
          onChange={(e) => onVersionChange(e.target.value)}
          aria-label="Quick edit version"
          placeholder="1.0.0"
        />
      </div>

      {/* Row: Author Inline Input */}
      <div className="flex justify-between items-center py-1.5 border-b border-white/2 text-sm text-gray-300 group">
        <span className="shrink-0">Author</span>
        <input
          type="text"
          className="bg-transparent border-none outline-none text-right text-white font-semibold text-sm p-0 w-40 focus:outline-none focus:text-[#8b5cf6] transition-colors placeholder-gray-600"
          value={author}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder="—"
          aria-label="Quick edit author"
        />
      </div>

      {/* Row: Last Modified */}
      <div className="flex justify-between items-center py-2 text-sm text-gray-300">
        <span>Last Modified</span>
        <strong className="text-white font-semibold text-sm">
          {lastModified}
        </strong>
      </div>
    </div>
  )
}