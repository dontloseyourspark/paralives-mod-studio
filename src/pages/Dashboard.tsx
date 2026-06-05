import DashboardCard from '../components/DashboardCard'
import { Plus, Folder, DownloadSimple, WarningCircle, X } from 'phosphor-react'
import type { ModProject } from '../types'
import '../styles/Dashboard.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const createProject = useModStore((s) => s.createProject)
  const recentProjects = useModStore((s) => s.recentProjects)
  const setProject = useModStore((s) => s.setProject)

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

  const handleImportMod = () => {
    setToast({ message: 'Mod import is not supported yet.', type: 'error' })
  }

  const handleOpenProject = (project: ModProject) => {
    setProject(project)
    navigate(`/project/${project.id}`)
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Paralives Mod Editor</h1>
        <p className="subtitle">Create and manage custom content for Paralives</p>
      </div>

      <section className="dashboard-info">
        <span className="button-icon">{<WarningCircle size={24} />}</span>
        <span>Only items are supported at this moment. Other mod-focused features will be added soon.</span>
      </section>

      <section className="actions">
        <div className="actions-grid">
          <DashboardCard
            icon={<Plus size={24} />}
            text="Create New Mod"
            description="Start a fresh mod project from scratch"
            onClick={handleCreateMod}
          />

          <DashboardCard
            icon={<Folder size={24} />}
            text="Open Existing Mod"
            description="Browse and open a saved mod file"
            onClick={handleOpenMod}
          />

          <DashboardCard
            icon={<DownloadSimple size={24} />}
            text="Import Mod"
            description="Import an existing mod package"
            onClick={handleImportMod}
          />
        </div>
      </section>

      <section className="recent-projects">
        <h2>Recent Projects</h2>
        {recentProjects.length === 0 ? (
          <p className="empty-state">No recent projects yet. Create or open a mod to get started!</p>
        ) : (
          <div className="projects-list">
            {recentProjects.map((project) => (
              <div key={project.id} className="project-item" onClick={() => handleOpenProject(project)}>
                <div className="project-item-left">
                  <h3>{project.name}</h3>
                  <p className="project-path">{project.description}</p>
                </div>
                <div className="project-item-meta">
                  <div className="meta-row"><span>Author:</span><strong>{project.author || '—'}</strong></div>
                  <div className="meta-row"><span>Version:</span><strong>{project.version}</strong></div>
                  <div className="meta-row"><span>Items:</span><strong>{project.items.length}</strong></div>
                  <div className="meta-row"><span>Last modified:</span><strong>{new Date(project.updatedAt).toLocaleDateString()}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {toast && (
        <div className="toast-panel">
          <div className={`toast-message toast-${toast.type}`}>
            <div className="toast-copy">
              <strong>{toast.message}</strong>
            </div>
            <button className="toast-close" onClick={() => setToast(null)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
