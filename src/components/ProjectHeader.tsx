import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FloppyDisk, X as XIcon } from 'phosphor-react'

interface ProjectHeaderProps {
  projectName: string
  projectVersion: string
  onNameChange: (value: string) => void
  onVersionChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

export default function ProjectHeader({
  projectName,
  projectVersion,
  onNameChange,
  onSave,
  onClose,
}: ProjectHeaderProps) {
  const navigate = useNavigate()

  return (
    
    <div className="flex justify-between items-center bg-[#131928] px-6 py-3 border-b border-white/5 w-full h-[70px] box-border select-none"> 
      
      {/* Left side: Back arrow and Input Title stack */}
      <div className="flex items-center gap-4 h-full">
        <button 
          className="bg-transparent border-none outline-none text-gray-400 hover:text-white cursor-pointer p-1 flex items-center justify-center transition-colors duration-150 focus:outline-none" 
          onClick={() => navigate('/')} 
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        
        <div className="flex flex-col justify-center">
          {/* Invisible style input field */}
          <input
            className="leading-none bg-transparent border-none outline-none text-white font-semibold text-xl w-64 focus:outline-none focus:ring-0 placeholder-gray-500 line-height-none  p-0 m-0"
            value={projectName}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label="Mod name"
            placeholder="Untitled Mod"
          />
          <div className="text-gray-500 text-sm mt-0 font-regular leading-none">Editing mod project</div>
        </div>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-4 h-full">
        {/* Version Pill */}
        <span className="px-3 py-1 text-xs font-semibold text-gray-400 bg-transparent border border-gray-700 rounded-full flex items-center justify-center h-7 box-border" aria-label="Mod version">
          {projectVersion || "1.0.0"}
        </span>
       
        {/* Save Mod Button */}
        <button 
          className="flex items-center leading-6 gap-2 py-1 px-3 text-sm font-semibold text-white bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] rounded-md transition-colors duration-150 shadow-sm border-none outline-none cursor-pointer h-8 box-border focus:outline-none" 
          onClick={onSave}
        >
          <FloppyDisk size={16} weight="bold" />
          <span className="text-xs mt-0.5 leading-none">Save Mod</span>
        </button>

        {/* Close Button */}
        <button 
          className="bg-transparent border-none outline-none text-gray-400 hover:text-white cursor-pointer p-1 flex items-center justify-center transition-colors duration-150 focus:outline-none" 
          onClick={onClose} 
          aria-label="Close"
        >
          <XIcon size={20} weight="bold" />
        </button>
      </div>

    </div>
  )
}