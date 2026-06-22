// src/components/WorkshopTagsModal.tsx
//
// Steam Workshop publishing tags picker. Edits project.workshopTags directly via
// onProjectChange on every toggle (same "live edit" pattern as WorkspaceHeader's
// name/version/author inputs) — there's no separate save step within the modal.

import { X } from 'phosphor-react'
import type { ModProject } from '../types/types'
import { WORKSHOP_TAG_CATEGORIES, MAX_WORKSHOP_TAGS } from '../data/workshopTags'

interface WorkshopTagsModalProps {
  project: ModProject
  onProjectChange: (updated: ModProject) => void
  onClose: () => void
}

export default function WorkshopTagsModal({ project, onProjectChange, onClose }: WorkshopTagsModalProps) {
  const selectedTags = project.workshopTags ?? []
  const atCap = selectedTags.length >= MAX_WORKSHOP_TAGS

  const toggleTag = (tag: string) => {
    const isSelected = selectedTags.includes(tag)
    if (isSelected) {
      onProjectChange({ ...project, workshopTags: selectedTags.filter((t) => t !== tag) })
    } else if (!atCap) {
      onProjectChange({ ...project, workshopTags: [...selectedTags, tag] })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0e1017] border border-white/6 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-white">Workshop Tags</span>
            <span className={`text-[11px] font-medium ${atCap ? 'text-amber-400' : 'text-gray-500'}`}>
              {selectedTags.length}/{MAX_WORKSHOP_TAGS} selected
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/6 text-gray-500 hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-5">
          {WORKSHOP_TAG_CATEGORIES.map((category) => (
            <div key={category.id} className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {category.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {category.tags.map((tag) => {
                  const selected = selectedTags.includes(tag)
                  const disabled = !selected && atCap
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      disabled={disabled}
                      title={disabled ? `Remove a tag to add "${tag}" — max ${MAX_WORKSHOP_TAGS}` : undefined}
                      className={`
                        text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer outline-none
                        ${selected
                          ? 'border-[#8b5cf6] bg-[#8b5cf6]/15 text-[#a78bfa]'
                          : disabled
                            ? 'border-white/5 text-gray-600 cursor-not-allowed opacity-50'
                            : 'border-white/8 text-gray-400 hover:border-white/20 hover:text-gray-200'
                        }
                      `}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-sm font-semibold text-white cursor-pointer transition-all duration-150 outline-none border-none shadow-lg shadow-[#8b5cf6]/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
