import React from 'react'

interface AppShellProps {
  header: React.ReactNode
  sidebar: React.ReactNode
  main: React.ReactNode
  rightPanel?: React.ReactNode
}

export default function AppShell({ header, sidebar, main, rightPanel }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[#0e1017] text-white w-full">
      {/* Header Slot */}
      <div className="shrink-0 w-full z-10">
        {header}
      </div>

      {/* Main Workspace Grid Split */}
      <div className="grid grid-cols-[320px_1fr] has-[aside]:grid-cols-[320px_1fr_320px] gap-6 p-6 flex-1 min-h-0 w-full box-border">
        {/* Sidebar Slot (Left Column) */}
        <div className="w-[320px] shrink-0 min-h-0 overflow-y-auto">
          {sidebar}
        </div>

        {/* Main Content Slot (Center Area) */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-[#11131e]/40 border border-white/5 rounded-2xl">
          {main}
        </main>

        {/* Right Panel Slot (Conditional Right Column) */}
        {rightPanel && (
          <aside className="w-[320px] shrink-0 min-h-0 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
            {rightPanel}
          </aside>
        )}
      </div>
    </div>
  )
}