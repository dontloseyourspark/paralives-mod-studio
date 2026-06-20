// src/components/WorkspaceHeader.tsx
import { useRef, useState } from 'react'
import { ArrowLeft, FloppyDisk, Image, WarningCircle } from 'phosphor-react'
import type { ModProject } from '../types/types'
import { useModStore } from '../store/useModStore'

interface WorkspaceHeaderProps {
  project: ModProject
  isSaving: boolean
  hasUnsavedChanges: boolean
  onBack: () => void
  onSave: () => void
  onProjectChange: (updated: ModProject) => void
}

export default function WorkspaceHeader({
  project,
  isSaving,
  hasUnsavedChanges,
  onBack,
  onSave,
  onProjectChange,
}: WorkspaceHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [thumbnailWarning, setThumbnailWarning] = useState(false)

  const registerFileInCache = useModStore((s) => s.registerFileInCache)
  const stringUrlCache      = useModStore((s) => s.stringUrlCache)

  // If it's not in RAM, instantly rip it directly from the hard drive!
  const thumbnailUrl = project.coverThumbnailKey 
    ? stringUrlCache[project.coverThumbnailKey] || localStorage.getItem(`asset_fallback_${project.coverThumbnailKey}`)
    : null

  const handleThumbnailFile = (file: File) => {
    const key = `cover_${project.id}`
    registerFileInCache(key, file)
    onProjectChange({ ...project, coverThumbnailKey: key })

    // Check dimensions — Workshop requires exactly 1020×1020
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      setThumbnailWarning(img.naturalWidth !== img.naturalHeight || img.naturalWidth !== 1020)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleThumbnailFile(file)
  }

  return (
    <header className="h-14 border-b border-white/5 bg-[#161923] px-6 flex items-center justify-between shrink-0 select-none">
      {/* Left: Back button + project name */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer outline-none"
          title="Return to home entry view"
        >
          <ArrowLeft size={16} weight="bold" />
        </button>

       <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-gray-500 font-mono mt-0.5 tracking-tight flex items-center">
            Now editing mod project:
          </span>
          <input
            type="text"
            className="bg-transparent border-none text-sm font-bold text-white outline-none m-0 p-0 truncate focus:bg-white/2 rounded px-1"
            value={project.name}
            onChange={(e) => onProjectChange({ ...project, name: e.target.value })}
          />
        </div>
      </div>

      {/* Right: Version, author, thumbnail, save */}
      <div className="flex items-center gap-5 shrink-0">
        <div className="flex items-center gap-3 border-r border-white/5 pr-5 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Version:</span>
            <input
              type="text"
              className="w-12 bg-white/3 border border-white/5 text-center rounded py-0.5 text-gray-300 font-mono outline-none focus:border-[#8b5cf6]/40 text-[11px]"
              value={project.version}
              onChange={(e) => onProjectChange({ ...project, version: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Author:</span>
            <input
              type="text"
              className="w-24 bg-white/3 border border-white/5 px-1.5 rounded py-0.5 text-gray-300 font-medium outline-none focus:border-[#8b5cf6]/40 text-[11px]"
              value={project.author}
              onChange={(e) => onProjectChange({ ...project, author: e.target.value })}
            />
          </div>
        </div>

        {/* Workshop thumbnail drop zone */}
        <div className="border-r border-white/5 pr-5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleThumbnailFile(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            title={
              thumbnailWarning
                ? 'Thumbnail should be exactly 1020×1020 px — click to replace'
                : thumbnailUrl
                  ? 'Replace workshop thumbnail'
                  : 'Upload workshop thumbnail (1020×1020 PNG recommended)'
            }
            className={`
              relative w-8 h-8 rounded-lg border overflow-visible cursor-pointer transition-all outline-none
              ${dragging
                ? 'border-[#8b5cf6] bg-[#8b5cf6]/15 scale-110'
                : thumbnailWarning
                  ? 'border-amber-500/50 hover:border-amber-400/70'
                  : thumbnailUrl
                    ? 'border-[#8b5cf6]/30 hover:border-[#8b5cf6]/60'
                    : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
              }
            `}
          >
            {/* Inner content needs its own clip since button is now overflow-visible */}
            <div className="w-full h-full rounded-lg overflow-hidden">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="Workshop thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image size={14} className="text-gray-500" weight="light" />
                </div>
              )}
            </div>

            {/* Dimension warning badge */}
            {thumbnailWarning && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                <WarningCircle size={14} weight="fill" className="text-amber-400" />
              </span>
            )}
          </button>
        </div>

        {/* Save button — fills with accent colour and shows a pulsing dot when dirty */}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="relative flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-[#8b5cf6]/50 disabled:cursor-not-allowed rounded-xl cursor-pointer text-white shadow-sm transition-colors outline-none"
        >
          {/* Unsaved-changes dot */}
          {hasUnsavedChanges && !isSaving && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm animate-pulse" />
          )}
          <FloppyDisk size={14} weight="bold" />
          <span>{isSaving ? 'Saving…' : 'Save Mod'}</span>
        </button>
      </div>
    </header>
  )
}
