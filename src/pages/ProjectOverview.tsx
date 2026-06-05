import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import ItemEditor from '../components/ItemEditor'
import '../styles/Dashboard.css'

export default function ProjectOverview() {
  const project = useModStore((s) => s.currentProject)
  const updateProject = useModStore((s) => s.updateProject)
  const saveProject = useModStore((s) => s.saveProject)
  const setProject = useModStore((s) => s.setProject)
  const addItem = useModStore((s) => s.addItem)
  const [savedAt, setSavedAt] = useState('')
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
    addItem()
  }

  return (
    <div className="project-overview">
      <div className="project-header">
        <div className="project-header-left">
          <input
            type="text"
            value={project.name}
            onChange={handleNameChange}
            className="project-name-input"
            placeholder="Project Name"
          />
          <input
            type="text"
            value={project.author}
            onChange={(e) => updateProject({ author: e.target.value })}
            className="project-author-input"
            placeholder="Author"
          />
          <textarea
            value={project.description}
            onChange={handleDescriptionChange}
            className="project-description-input"
            placeholder="Project Description"
          />
        </div>

        <div className="project-header-right">
          <div className="project-meta">
            <div className="meta-item">Version: {project.version}</div>
            <div className="meta-item">Author: {project.author || '—'}</div>
            <div className="meta-item">Items: {project.items.length}</div>
          </div>

          <div className="project-toolbar">
            <button className="btn-save-project" onClick={handleSave}>
              Save Mod
            </button>
            <button className="btn-new-item" onClick={handleNewItem}>
              + New Item
            </button>
            <button className="btn-close-project" onClick={handleClose}>
              Close Mod
            </button>
          </div>

          {savedAt && <div className="saved-at">Saved: {savedAt}</div>}
        </div>
      </div>

      <section className="project-items">
        <h2>Items</h2>
        <ItemEditor />
      </section>
    </div>
  )
}
