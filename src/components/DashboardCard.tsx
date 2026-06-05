import type { ReactNode } from 'react'

interface DashboardCardProps {
  icon: ReactNode
  text: string
  description?: string
  onClick: () => void
}

export default function DashboardCard({ icon, text, description, onClick }: DashboardCardProps) {
  return (
    <button 
      className="flex flex-col items-start gap-3 p-5 w-full bg-[#161923] border border-white/5 hover:border-white/10 hover:bg-white/2 rounded-2xl cursor-pointer text-left transition-all duration-150 group select-none outline-none focus:outline-none" 
      onClick={onClick}
    >
      {/* Icon Wrapper */}
      <div className="flex items-center justify-center p-2 bg-white/2 group-hover:bg-white/5 rounded-xl transition-colors shrink-0">
        {icon}
      </div>
      
      {/* Text Context Stack */}
      <div className="flex flex-col gap-1 w-full">
        <span className="text-sm font-semibold text-white group-hover:text-[#8b5cf6] transition-colors leading-none">
          {text}
        </span>
        {description && (
          <span className="text-xs text-gray-500 leading-normal">
            {description}
          </span>
        )}
      </div>
    </button>
  )
}