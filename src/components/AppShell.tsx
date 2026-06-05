import React from 'react'

interface AppShellProps {
  header: React.ReactNode
  sidebar: React.ReactNode
  main: React.ReactNode
  rightPanel?: React.ReactNode
}

export default function AppShell({ header, sidebar, main, rightPanel }: AppShellProps) {
  return (
    <div className="app-shell">
      {/* Header */}
      <div className="app-header">{header}</div>

      {/* Main container */}
      <div className="app-container">
        {/* Sidebar */}
        <div className="app-sidebar">{sidebar}</div>

        {/* Main content */}
        <div className="app-main">{main}</div>

        {/* Right panel */}
       {rightPanel && <aside>{rightPanel}</aside>}
      </div>
    </div>
  )
}
