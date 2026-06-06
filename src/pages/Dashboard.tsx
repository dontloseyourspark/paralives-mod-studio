import DashboardCard from '../components/DashboardCard'
import { Plus, Folder, DownloadSimple, WarningCircle, X } from 'phosphor-react'
import type { ModProject } from '../types/types'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import ModImporter from '../components/ModImporter'

export default function Dashboard() {
  const navigate = useNavigate()
  const createProject = useModStore((s) => s.createProject)
  const recentProjects = useModStore((s) => s.recentProjects)
  const setProject = useModStore((s) => s.setProject)
  
  // Hook to pull the persistent binary image access URLs out of memory
  const getBlobUrlFromCache = useModStore((s) => s.getBlobUrlFromCache)

  const handleCreateMod = () => {
    const project = createProject()
    navigate(`/project/${project.id}`)
  }

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleOpenMod = () => {
    setToast({ message: 'Opening existing mods is not available yet.', type: 'error' })
  }

  const handleImportComplete = (importedProject: ModProject) => {
    setProject(importedProject) 
    navigate(`/project/${importedProject.id}`) 
  }

  const handleOpenProject = (project: ModProject) => {
    setProject(project)
    navigate(`/project/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-[#0e1017] text-white px-8 py-12 flex flex-col gap-8 max-w-5xl mx-auto box-border">
      {/* Header */}
      <div className="select-none">
        <h1 className="text-3xl font-bold tracking-tight text-white m-0">Paralives Mod Editor</h1>
        <p className="text-sm text-gray-500 mt-1.5 font-medium">Create and manage custom content for Paralives</p>
      </div>

      {/* Warning/Info Callout */}
      <section className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl text-amber-200 text-sm font-medium select-none">
        <WarningCircle size={22} className="text-amber-500 shrink-0" />
        <span>Only items are supported at this moment. Other mod-focused features will be added soon.</span>
      </section>

      {/* Primary Actions Grid */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard
            icon={<Plus size={24} weight="bold" className="text-[#8b5cf6]" />}
            text="Create New Mod"
            description="Start a fresh mod project from scratch"
            onClick={handleCreateMod}
          />

          <DashboardCard
            icon={<Folder size={24} weight="bold" className="text-gray-400" />}
            text="Open Existing Mod"
            description="Browse and open a saved mod file"
            onClick={handleOpenMod}
          />

          <DashboardCard
            icon={<DownloadSimple size={24} weight="bold" className="text-gray-500" />}
            text="Cloud Sync"
            description="Feature coming soon"
            onClick={() => alert("Coming soon!")}
          />
        </div>
      </section>

      {/* Dedicated Ingest Dropzone Section */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-gray-300 m-0">Import External Mod Package</h2>
        <ModImporter onImportComplete={handleImportComplete} />
      </section>

      {/* Recent Projects List */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-gray-300 select-none m-0">Recent Projects</h2>
        
        {(!recentProjects || recentProjects.length === 0) ? (
          <div className="text-sm text-gray-500 text-center py-12 px-4 bg-[#161923] rounded-2xl border border-dashed border-white/5 leading-relaxed select-none">
            No recent projects yet. Create or open a mod to get started!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentProjects.map((project) => {
              // Resolve the high-res root cover image directly out of our global file buffer cache
              const liveCoverUrl = getBlobUrlFromCache(project.coverThumbnailKey ?? null)

              return (
                <div 
                  key={project.id} 
                  className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-[#161923] border border-white/5 hover:border-white/10 hover:bg-white/2 rounded-2xl cursor-pointer transition-all duration-150 select-none group" 
                  onClick={() => handleOpenProject(project)}
                >
                  {/* Visual Project Cover Artwork Node */}
                  <div className="w-14 h-14 bg-black/20 border border-white/5 rounded-xl overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-inner">
                    {liveCoverUrl ? (
                      <img src={liveCoverUrl} alt={project.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Folder size={20} className="text-gray-600" />
                    )}
                  </div>

                  {/* Project Identity Labels */}
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <h3 className="text-sm font-semibold text-white group-hover:text-[#8b5cf6] transition-colors m-0 truncate">
                      {project.name || 'Untitled Mod'}
                    </h3>
                    <p className="text-xs text-gray-500 truncate m-0 max-w-md">
                      {project.description || 'No description provided.'}
                    </p>
                  </div>
                  
                  {/* Meta Information Metadata Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[11px] border-t border-white/5 md:border-none pt-3 md:pt-0 shrink-0">
                    <div className="flex items-center gap-1.5"><span className="text-gray-500">Author:</span><strong className="text-gray-300 font-semibold truncate max-w-[80px]">{project.author || '—'}</strong></div>
                    <div className="flex items-center gap-1.5"><span className="text-gray-500">Version:</span><strong className="text-gray-300 font-semibold">{project.version || '1.0.0'}</strong></div>
                    
                    {/* CRITICAL SAFETY UPDATE: Optional chaining maps safely if items is empty/undefined */}
                    <div className="flex items-center gap-1.5"><span className="text-gray-500">Items:</span><strong className="text-gray-300 font-semibold">{project?.items?.length ?? 0}</strong></div>
                    
                    <div className="flex items-center gap-1.5"><span className="text-gray-500">Modified:</span><strong className="text-gray-300 font-semibold">{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '—'}</strong></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Toast Overlay Banner Notifications */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md min-w-[300px] max-w-md ${
            toast.type === 'error' 
              ? 'bg-rose-950/80 border-rose-500/30 text-rose-200' 
              : 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="text-sm font-medium">
              {toast.message}
            </div>
            <button 
              className="bg-transparent border-none text-current opacity-60 hover:opacity-100 cursor-pointer p-0.5 flex items-center justify-center transition-opacity focus:outline-none" 
              onClick={() => setToast(null)} 
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}