// src/pages/Dashboard.tsx
import DashboardCard from '../components/DashboardCard'
import { Plus, Folder, WarningCircle, X, Trash, MagnifyingGlass } from 'phosphor-react'
import type { ModProject } from '../types/types'
import { makeDefaultItem } from '../types/types'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import ModImporter from '../components/ModImporter'
import CreateModWizard, { type TranslationWizardPayload } from '../components/CreateModWizard'
import type { Item } from '../types/types'
import englishReference from '../data/englishReference.json'

export default function Dashboard() {
  const navigate            = useNavigate()
  const createProject       = useModStore((s) => s.createProject)
  const recentProjects      = useModStore((s) => s.recentProjects)
  const setProject          = useModStore((s) => s.setProject)
  const setSelectedItemId   = useModStore((s) => s.setSelectedItemId)
  const addItemWith         = useModStore((s) => s.addItemWith)
  const getBlobUrlFromCache = useModStore((s) => s.getBlobUrlFromCache)
  const deleteProject       = useModStore((s) => s.deleteProject)
  const clearAllProjects    = useModStore((s) => s.clearAllProjects)

  const totalStrings = Object.keys(englishReference).length
  const countCompleted = (project: ModProject) =>
    Object.values(project.translations?.[0]?.strings ?? {}).filter((v) => v && v.trim().length > 0).length

  const [wizardOpen, setWizardOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!toast) return
    // Errors carry a full sentence plus a recovery hint — give them time to read.
    const timer = window.setTimeout(() => setToast(null), toast.type === 'error' ? 8000 : 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredProjects = searchQuery.trim() === ''
    ? recentProjects
    : recentProjects.filter((p) => {
        const q = searchQuery.toLowerCase()
        return (
          p.name?.toLowerCase().includes(q) ||
          p.author?.toLowerCase().includes(q) ||
          p.modType?.toLowerCase().includes(q)
        )
      })

  const handleCreateMod = () => setWizardOpen(true)

  const handleWizardAdvanced = (payload: Partial<Item> | TranslationWizardPayload) => {
    const project = createProject()

    if ('isTranslation' in payload && payload.isTranslation) {
      const initialStrings: Record<string, string> = {}
      Object.keys(englishReference).forEach((guid) => {
        initialStrings[guid] = ''
      })

      const newTranslation = {
        language: payload.language || 'Unknown',
        strings: initialStrings
      }

      const updatedProject = {
        ...project,
        modType: 'translation' as const,
        name: `${payload.language} Translation`,
        translations: [newTranslation],
        updatedAt: new Date().toISOString()
      }
      setProject(updatedProject)
    } else {
      const partial = payload as Partial<Item>
      const hasContent = partial.name && partial.name !== 'New Mod Item'
      if (hasContent) {
        const newItem = makeDefaultItem({
          id:   partial.id   ?? crypto.randomUUID(),
          guid: partial.guid ?? crypto.randomUUID(),
          name: partial.name ?? 'New Mod Item',
          description: partial.description ?? '',
          price: partial.price ?? 0,
          thumbnailKey: partial.thumbnailKey ?? null,
          textureKeys:  partial.textureKeys  ?? {},
          componentBlueprints: partial.componentBlueprints ?? { rootDefaultStates: [], materialSurfaces: [] },
          components: partial.components ?? [],
        })
        addItemWith(newItem)
      }
    }

    setWizardOpen(false)
    navigate(`/project/${project.id}`)
  }

  const handleOpenMod = () => {
    fileInputRef.current?.click()
  }

  const handleImportComplete = (importedProject: ModProject) => {
    setProject(importedProject)
    setSelectedItemId(importedProject.items[0]?.id ?? null)
    navigate(`/project/${importedProject.id}`)
  }

  const handleOpenProject = (project: ModProject) => {
    setProject(project)
    setSelectedItemId(project.items[0]?.id ?? null)
    navigate(`/project/${project.id}`)
  }

  const handleDeleteProject = (e: React.MouseEvent, project: ModProject) => {
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to remove "${project.name || 'Untitled Mod'}" from your recent projects?`)) return
    deleteProject(project.id)
    setToast({ message: 'Project removed from recent projects.', type: 'info' })
  }

  const handleClearAll = () => {
    if (!window.confirm(`Remove all ${recentProjects.length} projects from your recent list? This can't be undone.`)) return
    clearAllProjects()
    setSearchQuery('')
    setToast({ message: 'All recent projects cleared.', type: 'info' })
  }

  return (
    <div className="min-h-screen bg-[#0e1017] text-white px-8 py-12 flex flex-col gap-8 max-w-5xl mx-auto box-border">
      {/* Header */}
      <div className="select-none">
        <h1 className="text-3xl font-bold tracking-tight text-white m-0">Paralives Mod Editor</h1>
        <p className="text-sm text-gray-500 mt-1.5 font-medium">Create and manage custom content for Paralives</p>
      </div>

      {/* Warning Callout */}
      <section className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl text-amber-200 text-sm font-medium select-none">
        <WarningCircle size={22} className="text-amber-500 shrink-0" />
        <span>Only limited mod types are supported at this moment. Other mod-focused features will be added soon.</span>
      </section>

      {/* Primary actions — create, or open/import an existing mod. The "Open
          Existing Mod" card and the dropzone below are the same import pipeline
          (ModImporter); they're grouped in one section so newcomers don't have
          to guess the difference between "opening" and "importing". */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard
            icon={<Plus size={24} weight="bold" className="text-[#8b5cf6]" />}
            text="Create New Mod"
            description="Start a fresh mod project from scratch"
            onClick={handleCreateMod}
          />
          <DashboardCard
            icon={<Folder size={24} weight="bold" className="text-gray-400" />}
            text="Open Existing Mod"
            description="Open a .mod folder you exported earlier or downloaded"
            onClick={handleOpenMod}
          />
        </div>
        <ModImporter
          onImportComplete={handleImportComplete}
          onError={(message) => setToast({ message, type: 'error' })}
          triggerRef={fileInputRef}
        />
      </section>

      {/* Recent Projects */}
      <section className="flex flex-col gap-4">

        {/* Section header */}
        <div className="flex items-center gap-3 select-none">
          <h2 className="text-lg font-semibold tracking-tight text-gray-300 m-0 shrink-0">Recent Projects</h2>

          {/* Search — only shown when there are projects */}
          {recentProjects.length > 0 && (
            <div className="relative flex-1 max-w-56">
              <MagnifyingGlass
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Filter projects…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/3 border border-white/8 rounded-lg pl-7 pr-7 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 outline-none focus:border-[#8b5cf6]/40 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors outline-none cursor-pointer"
                >
                  <X size={11} weight="bold" />
                </button>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Clear all */}
          {recentProjects.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-400 transition-colors cursor-pointer outline-none shrink-0"
            >
              <Trash size={13} />
              Clear all
            </button>
          )}
        </div>

        {recentProjects.length === 0 ? (
          /* No projects at all */
          <div className="text-sm text-gray-500 text-center py-12 px-4 bg-[#161923] rounded-2xl border border-dashed border-white/5 leading-relaxed select-none">
            No recent projects yet. Create or open a mod to get started!
          </div>
        ) : filteredProjects.length === 0 ? (
          /* Projects exist but none match the search */
          <div className="text-sm text-gray-500 text-center py-12 px-4 bg-[#161923] rounded-2xl border border-dashed border-white/5 leading-relaxed select-none">
            No projects match <span className="text-gray-400 font-medium">"{searchQuery}"</span>
          </div>
        ) : (
          <>
            {/* Small screens: compact rows */}
            <div className="flex flex-col gap-3 lg:hidden">
              {filteredProjects.map((project) => {
                const liveCoverUrl = project.coverThumbnailKey
                  ? getBlobUrlFromCache(project.coverThumbnailKey)
                  : null
                const isTranslation = project.modType === 'translation'

                return (
                  <div
                    key={project.id}
                    className="relative flex flex-row items-center gap-4 p-4 bg-[#161923] border border-white/5 hover:border-white/10 hover:bg-white/2 rounded-2xl cursor-pointer transition-all duration-150 select-none group"
                    onClick={() => handleOpenProject(project)}
                  >
                    <div className="w-12 h-12 bg-black/20 border border-white/5 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                      {liveCoverUrl ? (
                        <img src={liveCoverUrl} alt={project.name} className="w-full h-full object-cover" />
                      ) : (
                        <Folder size={18} className="text-gray-600" />
                      )}
                    </div>

                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <h3 className="text-sm font-semibold text-white group-hover:text-[#8b5cf6] transition-colors m-0 truncate">
                        {project.name || 'Untitled Mod'}
                      </h3>
                      <p className="text-xs text-gray-500 m-0 truncate">
                        {project.author || '—'} · v{project.version || '1.0.0'} · {isTranslation
                          ? `${countCompleted(project)}/${totalStrings} strings`
                          : `${project?.items?.length ?? 0} items`}
                      </p>
                    </div>

                    <span className="text-[11px] text-gray-600 shrink-0 group-hover:opacity-0 transition-opacity">
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '—'}
                    </span>

                    {/* Per-card delete button */}
                    <button
                      onClick={(e) => handleDeleteProject(e, project)}
                      title="Remove from recent projects"
                      className="absolute right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer outline-none"
                    >
                      <X size={13} weight="bold" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Large screens: cards grid */}
            <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const liveCoverUrl = project.coverThumbnailKey
                  ? getBlobUrlFromCache(project.coverThumbnailKey)
                  : null
                const isTranslation = project.modType === 'translation'

                return (
                  <div
                    key={project.id}
                    className="relative flex flex-col bg-[#161923] border border-white/5 hover:border-[#8b5cf6]/30 hover:bg-white/2 rounded-2xl cursor-pointer transition-all duration-150 select-none group overflow-hidden"
                    onClick={() => handleOpenProject(project)}
                  >
                    {/* Per-card delete button */}
                    <button
                      onClick={(e) => handleDeleteProject(e, project)}
                      title="Remove from recent projects"
                      className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-black/40 text-gray-400 hover:text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer outline-none backdrop-blur-sm"
                    >
                      <X size={13} weight="bold" />
                    </button>

                    <div className="w-full h-32 bg-black/30 border-b border-white/5 flex items-center justify-center overflow-hidden">
                      {liveCoverUrl ? (
                        <img src={liveCoverUrl} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <Folder size={32} className="text-gray-500" />
                          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">No cover</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 p-4">
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-semibold text-white group-hover:text-[#8b5cf6] transition-colors m-0 truncate">
                          {project.name || 'Untitled Mod'}
                        </h3>
                        <p className="text-xs text-gray-500 m-0 line-clamp-2 leading-relaxed">
                          {project.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1.5"><span className="text-gray-500">Author</span><strong className="text-gray-300 font-semibold truncate">{project.author || '—'}</strong></div>
                        <div className="flex items-center gap-1.5"><span className="text-gray-500">Version</span><strong className="text-gray-300 font-semibold">{project.version || '1.0.0'}</strong></div>
                        {isTranslation ? (
                          <div className="flex items-center gap-1.5"><span className="text-gray-500">Strings</span><strong className="text-gray-300 font-semibold">{countCompleted(project)}/{totalStrings}</strong></div>
                        ) : (
                          <div className="flex items-center gap-1.5"><span className="text-gray-500">Items</span><strong className="text-gray-300 font-semibold">{project?.items?.length ?? 0}</strong></div>
                        )}
                        <div className="flex items-center gap-1.5"><span className="text-gray-500">Modified</span><strong className="text-gray-300 font-semibold">{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '—'}</strong></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md min-w-[300px] max-w-md ${
            toast.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/30 text-rose-200'
              : toast.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
              : 'bg-[#1e2130]/90 border-white/10 text-gray-300'
          }`}>
            <div className="text-sm font-medium">{toast.message}</div>
            <button
              className="bg-transparent border-none text-current opacity-60 hover:opacity-100 cursor-pointer p-0.5 flex items-center justify-center transition-opacity focus:outline-none"
              onClick={() => setToast(null)}
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      )}

      <CreateModWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onAdvancedEditing={handleWizardAdvanced}
      />
    </div>
  )
}
