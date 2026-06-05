import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import AppShell from '../components/AppShell'
import ProjectHeader from '../components/ProjectHeader'
import ItemsPanel from '../components/ItemsPanel'
import ItemEditorPanel from '../components/ItemEditorPanel'
import QuickStats from '../components/QuickStats'
import { X as XIcon } from 'phosphor-react'
import '../styles/Dashboard.css'

export default function ProjectOverview() {
  const project = useModStore((s) => s.currentProject)
  const selectedItemId = useModStore((s) => s.selectedItemId)
  const selectItem = useModStore((s) => s.selectItem)
  const updateProject = useModStore((s) => s.updateProject)
  const updateItem = useModStore((s) => s.updateItem)
  const deleteItem = useModStore((s) => s.deleteItem)
  const saveProject = useModStore((s) => s.saveProject)
  const setProject = useModStore((s) => s.setProject)
  const addItemWith = useModStore((s) => s.addItemWith)

  const [savedAt, setSavedAt] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!project) {
    return <div className="project-overview"><p>No project loaded.</p></div>
  }

  const selectedItem = project.items.find((it) => it.id === selectedItemId)

  const handleSave = () => {
    const success = saveProject()
    if (!success) {
      setToast({ message: 'Unable to save mod. Please try again.', type: 'error' })
      return
    }
    setSavedAt(new Date().toLocaleString())
    setToast({ message: 'Your mod has been saved.', type: 'success' })
  }

  const handleClose = () => {
    setProject(null)
    try {
      window.localStorage.removeItem('paralives-mod-studio-current-project')
    } catch (e) {
      setToast({ message: 'Could not clear current project from storage.', type: 'error' })
    }
    navigate('/')
  }

  const handleAddItem = () => {
    addItemWith({ name: 'New Item', description: '', price: 0, tags: [] })
  }

  const handleDeleteItem = (id: string) => {
    deleteItem(id)
    if (selectedItemId === id) {
      selectItem(null)
    }
  }

  // Header component
  const header = (
    <ProjectHeader
      projectName={project.name}
      projectVersion={project.version}
      onNameChange={(value) => updateProject({ name: value })}
      onVersionChange={(value) => updateProject({ version: value })}
      onSave={handleSave}
      onClose={handleClose}
    />
  )

  // Sidebar component (items list)
 const sidebar = (
  <div className="sidebar-content">
  

    {savedAt && (
      <div className="saved-at aside-saved-at">
        Saved: {savedAt}
      </div>
    )}

    <QuickStats
      totalItems={project.items.length}
      version={project.version}
      author={project.author}
      lastModified={new Date(project.updatedAt).toLocaleDateString()}
      onVersionChange={(value) => updateProject({ version: value })}
      onAuthorChange={(value) => updateProject({ author: value })}
    />

      <ItemsPanel
      items={project.items}
      selectedItemId={selectedItemId}
      onSelectItem={selectItem}
      onAddItem={handleAddItem}
      onDeleteItem={handleDeleteItem}
    />

    <div className="tips card">
      <h4>Tips</h4>
      <ul>
        <li>Use descriptive names for your items to keep them organized</li>
        <li>Save your mod frequently to avoid losing work</li>
        <li>Items are saved to your project when you save</li>
      </ul>
    </div>
  </div>
);

  // Main content (editor)
 const main = (
  <ItemEditorPanel
    item={selectedItem}
    onNameChange={(value) => {
      if (selectedItem) updateItem(selectedItem.id, { name: value })
    }}
    onDescriptionChange={(value) => {
      if (selectedItem) updateItem(selectedItem.id, { description: value })
    }}
    onPriceChange={(value) => {
      if (selectedItem) updateItem(selectedItem.id, { price: value })
    }}
    onTagsChange={(value) => {
      if (selectedItem) updateItem(selectedItem.id, { tags: value })
    }}
  />
)

  /* // Right panel (quick stats)
  const rightPanel = (
    <>
    </>
  ) */

  return (
    <div className="project-overview">
      <AppShell header={header} sidebar={sidebar} main={main} />

      {toast && (
        <div className="toast-panel">
          <div className={`toast-message toast-${toast.type}`}>
            <div className="toast-copy">
              <strong>{toast.message}</strong>
            </div>
            <button className="toast-close" onClick={() => setToast(null)} aria-label="Dismiss notification">
              <XIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
