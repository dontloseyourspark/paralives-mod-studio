// src/components/DashboardCard.tsx
import type { ReactNode } from 'react'

interface DashboardCardProps {
  icon?: ReactNode
  text: string
  description?: string
  imageUrl?: string | null // Added specific image prop
  onClick: () => void
}

export default function DashboardCard({ icon, text, description, imageUrl, onClick }: DashboardCardProps) {
  return (
    <button 
      className="flex flex-col items-start p-0 w-full bg-[#161923] border border-white/5 hover:border-white/10 hover:bg-white/2 rounded-2xl cursor-pointer text-left transition-all duration-150 group select-none outline-none focus:outline-none overflow-hidden shadow-lg shadow-black/20" 
      onClick={onClick}
    >
      {/* Cover Image or Icon Wrapper */}
      {imageUrl ? (
        <div className="w-full h-32 bg-black/50 border-b border-white/5 shrink-0 overflow-hidden relative">
          <img 
            src={imageUrl} 
            alt={text} 
            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-300" 
          />
        </div>
      ) : (
        <div className="w-full h-32 flex items-center justify-center bg-white/2 group-hover:bg-white/5 border-b border-white/5 transition-colors shrink-0">
          <div className="p-3 bg-white/5 rounded-xl text-gray-400 group-hover:text-[#8b5cf6] transition-colors shadow-inner">
            {icon}
          </div>
        </div>
      )}
      
      {/* Text Context Stack */}
      <div className="flex flex-col gap-1 w-full p-4">
        <span className="text-sm font-semibold text-white group-hover:text-[#8b5cf6] transition-colors leading-none truncate w-full">
          {text}
        </span>
        {description && (
          <span className="text-xs text-gray-500 leading-normal line-clamp-2 mt-1">
            {description}
          </span>
        )}
      </div>
    </button>
  )
}