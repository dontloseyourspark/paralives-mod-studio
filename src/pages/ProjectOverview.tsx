import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FloppyDisk, Trash, Plus } from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import ItemsPanel from '../components/ItemsPanel'
import ItemEditorPanel from '../components/ItemEditorPanel'
import type { Item, ModProject } from '../types/types'

export default function ProjectOverview() {
  const navigate = useNavigate()

  // Centralized Zustand Store Selection Hooks
  const currentProject = useModStore((s) => s.currentProject)
  const selectedItemId = useModStore((s) => s.selectedItemId)
  const setSelectedItemId = useModStore((s) => s.setSelectedItemId)
  
  const updateProject = useModStore((s) => s.updateProject)
  const saveProject = useModStore((s) => s.saveProject)
  const clearCache = useModStore((s) => s.clearCache)
  
  const addItemWith = useModStore((s) => s.addItemWith)
  const updateItem = useModStore((s) => s.updateItem)
  const deleteItem = useModStore((s) => s.deleteItem)

  const [isSaving, setIsSaving] = useState(false)

  // Handle safe back-navigation and data teardown
  const handleBackToDashboard = () => {
    clearCache() // Line 53 Fix: Safely flush cache instead of forcing null down setProject
    navigate('/')
  }

  // Handle full schema saving commits
  const handleSaveProject = async () => {
    setIsSaving(true)
    saveProject()
    setTimeout(() => setIsSaving(false), 800)
  }

  // Line 62 Fix: Construct a fully populated, valid structural entity
  const handleAddNewItem = () => {
    const newItem: Item = {
      id: crypto.randomUUID(),
      guid: crypto.randomUUID(),
      name: 'New Custom Item',
      description: 'Custom decorative mod asset configuration.',
      price: 5,
      tags: ['Decorative'],
      thumbnailKey: null,
      textureKeys: {},
      componentBlueprints: {
        rootDefaultStates: [],
        materialSurfaces: []
      },
      components: []
    }
    addItemWith(newItem)
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-[#0e1017] text-gray-400 flex flex-col items-center justify-center gap-4">
        <p className="text-sm">No active mod project loaded in workspace context.</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white text-xs font-semibold cursor-pointer transition-colors">
          Return to Dashboard
        </button>
      </div>
    )
  }

  // Line 138 Fix: Resolve the selected item cleanly using an explicit null fallback
  const activeSelectedItem = currentProject.items.find((i) => i.id === selectedItemId) || null

  return (
    <div className="h-screen bg-[#0e1017] text-white flex flex-col select-none overflow-hidden box-border">
      
      {/* PERSISTENT WORKSPACE CONTROL HEADER BAR */}
      <header className="h-14 border-b border-white/5 bg-[#161923] px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-4 min-w-0">
          <button 
            onClick={handleBackToDashboard}
            className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer outline-none"
            title="Return to home entry view"
          >
            <ArrowLeft size={16} weight="bold" />
          </button>
          
          <div className="flex flex-col min-w-0">
            {/* Line 78 Fix: Spread modifications completely over the active manifest project object */}
            <input 
              type="text"
              className="bg-transparent border-none text-sm font-bold text-white outline-none m-0 p-0 truncate focus:bg-white/2 rounded px-1"
              value={currentProject.name}
              onChange={(e) => updateProject({ ...currentProject, name: e.target.value })}
            />
            <span className="text-[10px] text-gray-500 font-mono mt-0.5 tracking-tight">
              Project Manifest Workspace Manager
            </span>
          </div>
        </div>

        {/* Global Metadata Control Configurations Panel */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="flex items-center gap-3 border-r border-white/5 pr-5 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Version:</span>
              {/* Line 79 & 98 Fix: Maintain full object structures on metadata adjustments */}
              <input 
                type="text"
                className="w-12 bg-white/3 border border-white/5 text-center rounded py-0.5 text-gray-300 font-mono outline-none focus:border-[#8b5cf6]/40 text-[11px]"
                value={currentProject.version}
                onChange={(e) => updateProject({ ...currentProject, version: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Author:</span>
              {/* Line 99 Fix: Layer changes cleanly over top structural configurations */}
              <input 
                type="text"
                className="w-24 bg-white/3 border border-white/5 px-1.5 rounded py-0.5 text-gray-300 font-medium outline-none focus:border-[#8b5cf6]/40 text-[11px]"
                value={currentProject.author}
                onChange={(e) => updateProject({ ...currentProject, author: e.target.value })}
              />
            </div>
          </div>

          <button
            onClick={handleSaveProject}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-[#8b5cf6]/50 disabled:cursor-not-allowed rounded-xl cursor-pointer text-white shadow-sm transition-colors outline-none"
          >
            <FloppyDisk size={14} weight="bold" />
            <span>{isSaving ? 'Saving Changes...' : 'Commit Mod'}</span>
          </button>
        </div>
      </header>

      {/* THREE-COLUMN PRODUCTION EDITING CANVAS SCREEN */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* SIDEBAR LIST UTILITY: Manages the custom catalog items array */}
        <div className="relative h-full flex flex-col shrink-0">
          {/* Line 106 Fix: Map the correct parameters between the layout interface items */}
          <ItemsPanel 
            items={currentProject.items}
            selectedItemId={selectedItemId}
            onSelectItem={(item) => setSelectedItemId(item.id)}
          />
          
          {/* Absolute Lower Controls Panel Matrix */}
          <div className="absolute bottom-3 left-3 right-3 flex gap-2 select-none">
            <button
              onClick={handleAddNewItem}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer text-gray-300 hover:text-white border border-white/5 transition-all outline-none"
            >
              <Plus size={12} weight="bold" className="text-[#8b5cf6]" />
              <span>Add Variation</span>
            </button>
            
            {activeSelectedItem && (
              <button
                onClick={() => deleteItem(activeSelectedItem.id)}
                className="p-2 bg-rose-950/20 hover:bg-rose-950/60 text-rose-400 rounded-xl cursor-pointer border border-rose-500/10 hover:border-rose-500/30 transition-all outline-none"
                title="Delete highlighted structural row variation"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        </div>

        {/* WORKSPACE CENTRAL WORK CANVAS MAIN INTERFACE PANEL */}
        <main className="flex-1 h-full min-w-0 bg-[#0e1017]">
          {/* Lines 139 & 140+ Fix: Connect the singular update callback routine clearly */}
          <ItemEditorPanel 
            key={activeSelectedItem?.id}
            item={activeSelectedItem}
            onSave={updateItem}
          />
        </main>

      </div>
    </div>
  )
}