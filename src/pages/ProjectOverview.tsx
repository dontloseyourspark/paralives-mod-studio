import { useState } from 'react'
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
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [modalItem, setModalItem] = useState<any | null>(null)
  const navigate = useNavigate()

  if (!project) {
    return <div className="project-overview"><p>No project loaded.</p></div>
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProject({ name: e.target.value })
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateProject({ description: e.target.value })
  }

  const handleSave = () => {
    saveProject()
    setSavedAt(new Date().toLocaleString())
  }

  const handleClose = () => {
    setProject(null)
    try {
      window.localStorage.removeItem('paralives-mod-studio-current-project')
    } catch (e) {
      // ignore
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
      <div className="project-topbar">
        <div className="topbar-left">
          <button className="topbar-back" onClick={() => navigate('/')} aria-label="Back">
            {/* left arrow */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="topbar-title">
            <h2>{project.name}</h2>
            <div className="topbar-sub">Editing mod project</div>
          </div>
        </div>

        <div className="topbar-right">
          <div className="version-pill">v{project.version}</div>
          <button className="btn-save-mod" onClick={handleSave}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 4h14v16H5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 8h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> Save Mod</button>
        </div>
      </div>
      <div className="project-grid">
        <div className="project-left">
          <div className="mod-card">
            <div className="card-header">
              <h3>Mod Information</h3>
              <p className="card-sub">Basic details about your mod</p>
            </div>

            <div className="card-body">
              <div className="row">
                <div className="col">
                  <label>Mod Name</label>
                  <input
                    type="text"
                    value={project.name}
                    onChange={handleNameChange}
                    className="project-name-input"
                    placeholder="Mod name"
                  />
                </div>
                <div className="col">
                  <label>Author</label>
                  <input
                    type="text"
                    value={project.author}
                    onChange={(e) => updateProject({ author: e.target.value })}
                    className="project-author-input"
                    placeholder="Author"
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-full">
                  <label>Version</label>
                  <input
                    type="text"
                    value={project.version}
                    onChange={(e) => updateProject({ version: e.target.value })}
                    className="project-version-input"
                    placeholder="1.0.0"
                  />
                </div>
              </div>

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
            <div className="overview-actions">
            <button className="btn-save-project" onClick={handleSave}><FloppyDisk size={14} /> <span style={{marginLeft:8}}>Save Mod</span></button>
            <button className="btn-close-project" onClick={handleClose}><XIcon size={14} /> <span style={{marginLeft:8}}>Close Mod</span></button>
            {savedAt && <div className="saved-at">{savedAt}</div>}
          </div>

          <div className="quick-stats card">
            <h4>Quick Stats</h4>
            <div className="stat-row"><span>Total Items</span><span className="badge">{project.items.length}</span></div>
            <div className="stat-row"><span>Version</span><strong>{project.version}</strong></div>
            <div className="stat-row"><span>Author</span><strong>{project.author || '—'}</strong></div>
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
    </div>
  )
}
