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
    <div className="quick-stats card">
      <h4>Quick Stats</h4>
      <div className="stat-row">
        <span>Total Items</span>
        <span className="badge">{totalItems}</span>
      </div>
      <div className="stat-row stat-row-input">
        <span>Version</span>
        <input
          className="quick-stat-input"
          value={version}
          onChange={(e) => onVersionChange(e.target.value)}
          aria-label="Quick edit version"
        />
      </div>
      <div className="stat-row stat-row-input">
        <span>Author</span>
        <input
          className="quick-stat-input"
          value={author}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder="—"
          aria-label="Quick edit author"
        />
      </div>
      <div className="stat-row">
        <span>Last Modified</span>
        <strong>{lastModified}</strong>
      </div>
    </div>
  )
}
