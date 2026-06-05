import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import AppShell from '../components/AppShell'
import ProjectHeader from '../components/ProjectHeader'
import ItemsPanel from '../components/ItemsPanel'
import ItemEditorPanel from '../components/ItemEditorPanel'
import QuickStats from '../components/QuickStats'
import { X as XIcon, Lightbulb } from 'phosphor-react'

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
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0e1017] text-gray-400">
        <p className="text-sm font-medium">No project loaded.</p>
      </div>
    )
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

  // Sidebar component (consolidated left column panel layouts)
  const sidebar = (
    <div className="flex flex-col gap-5 w-full max-w-[320px] shrink-0">
      {savedAt && (
        <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20 select-none self-start">
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

      {/* Modern Dashboard Tips Card Layout with Phosphor Icons */}
      <div className="bg-[#161923] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 select-none flex items-center gap-1.5">
          <Lightbulb size={16} weight="duotone" className="text-[#8b5cf6]" />
          <span>Tips</span>
        </h4>
        <ul className="flex flex-col gap-3 text-xs text-gray-400 list-none p-0 m-0 leading-relaxed">
          <li className="flex items-start gap-2">
            <Lightbulb size={14} weight="bold" className="text-[#8b5cf6] shrink-0 mt-0.5" />
            <span>Use descriptive names for your items to keep them organized.</span>
          </li>
          <li className="flex items-start gap-2">
            <Lightbulb size={14} weight="bold" className="text-[#8b5cf6] shrink-0 mt-0.5" />
            <span>Save your mod frequently to avoid losing work.</span>
          </li>
          <li className="flex items-start gap-2">
            <Lightbulb size={14} weight="bold" className="text-[#8b5cf6] shrink-0 mt-0.5" />
            <span>Items are saved directly to your project context.</span>
          </li>
        </ul>
      </div>
    </div>
  )

  // Main content (editor view)
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

  return (
    <div className="min-h-screen bg-[#0e1017] text-white overflow-x-hidden relative">
      <AppShell header={header} sidebar={sidebar} main={main} />

      {/* Styled Toast System */}
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
              className="bg-transparent border-none text-current opacity-60 hover:opacity-100 cursor-pointer p-0.5 flex items-center justify-center transition-opacity" 
              onClick={() => setToast(null)} 
              aria-label="Dismiss notification"
            >
              <XIcon size={16} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}