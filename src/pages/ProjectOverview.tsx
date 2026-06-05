import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import ItemEditor from '../components/ItemEditor'
import CreateItemModal from '../components/CreateItemModal'
import { Plus, FloppyDisk, X as XIcon } from 'phosphor-react'
import '../styles/Dashboard.css'

export default function ProjectOverview() {
  const project = useModStore((s) => s.currentProject)
  const updateProject = useModStore((s) => s.updateProject)
  const saveProject = useModStore((s) => s.saveProject)
  const setProject = useModStore((s) => s.setProject)
  
  const [savedAt, setSavedAt] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [modalItem, setModalItem] = useState<any | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!project) {
    return <div className="project-overview"><p>No project loaded.</p></div>
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProject({ name: e.target.value })
  }

  const handleAuthorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProject({ author: e.target.value })
  }

  const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProject({ version: e.target.value })
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateProject({ description: e.target.value })
  }

  const handleSave = () => {
    const success = saveProject()
    if (!success) {
      setToast({ message: 'Unable to save mod. Please try again.', type: 'error' })
      return
    }

    setSavedAt(new Date().toLocaleString())
    setToast({ message: 'Your mod has been saved.', type: 'success' })
  }

  const closeToast = () => setToast(null)

  const handleClose = () => {
    setProject(null)
    try {
      window.localStorage.removeItem('paralives-mod-studio-current-project')
    } catch (e) {
      setToast({ message: 'Could not clear current project from storage.', type: 'error' })
    }
    navigate('/')
  }

  const handleNewItem = () => {
    setModalItem(null)
    setIsCreateOpen(true)
  }

  // modal will call store directly; just manage open/close state here

  return (
    <div className="project-overview">
      <div className="header-nav">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="title-stack">
            <input
              className="title-input"
              value={project.name}
              onChange={handleNameChange}
              aria-label="Mod name"
            />
            <div className="subtitle">Editing mod project</div>
          </div>
        </div>

        <div className="header-right">
          <input
            className="version-input"
            value={project.version}
            onChange={handleVersionChange}
            aria-label="Mod version"
          />
          <button className="save-btn" onClick={handleSave}>
            <FloppyDisk size={14} />
            <span className="save-btn-text">Save Mod</span>
          </button>
          <button className="close-icon-btn" onClick={handleClose} aria-label="Close">
            <XIcon size={18} weight="bold" />
          </button>
        </div>
      </div>
      <div className="project-grid">
        <div className="project-left">
          <div className="mod-card">
            <div className="card-header">
              <p className="card-sub">Basic details about your mod</p>
            </div>

            <div className="card-body">
        

              <div className="row">
                <div className="col-full">
                  <label>Description</label>
                  <textarea
                    value={project.description}
                    onChange={handleDescriptionChange}
                    className="project-description-input"
                    placeholder="Project Description"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="items-card">
            <div className="card-header items-header">
              <h3>Items</h3>
              <p className="card-sub">Manage items in your mod ({project.items.length} total)</p>
              <div className="items-actions">
                <button className="btn-add-item" onClick={handleNewItem}><Plus size={14} /> <span style={{marginLeft:8}}>Add Item</span></button>
              </div>
            </div>

            <div className="card-body">
                <ItemEditor hideCreateButton onEdit={(it) => { setModalItem(it); setIsCreateOpen(true) }} />
                <CreateItemModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} item={modalItem} />
            </div>
          </div>
        </div>

        <aside className="project-right">
            {savedAt && <div className="saved-at aside-saved-at">Saved: {savedAt}</div>}

          <div className="quick-stats card">
            <h4>Quick Stats</h4>
            <div className="stat-row"><span>Total Items</span><span className="badge">{project.items.length}</span></div>
            <div className="stat-row stat-row-input"><span>Version</span>
              <input
                className="quick-stat-input"
                value={project.version}
                onChange={handleVersionChange}
                aria-label="Quick edit version"
              />
            </div>
            <div className="stat-row stat-row-input"><span>Author</span>
              <input
                className="quick-stat-input"
                value={project.author}
                onChange={handleAuthorChange}
                placeholder="—"
                aria-label="Quick edit author"
              />
            </div>
            <div className="stat-row"><span>Last Modified</span><strong>{new Date(project.updatedAt).toLocaleDateString()}</strong></div>
          </div>

          <div className="tips card">
            <h4>Tips</h4>
            <ul>
              <li>Use descriptive names for your items to keep them organized</li>
              <li>Save your mod frequently to avoid losing work</li>
              <li>Search appears when you have 4+ items</li>
            </ul>
          </div>
        </aside>
      </div>
      {toast && (
        <div className="toast-panel">
          <div className={`toast-message toast-${toast.type}`}>
            <div className="toast-copy">
              <strong>{toast.message}</strong>
            </div>
            <button className="toast-close" onClick={closeToast} aria-label="Dismiss notification">
              <XIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
