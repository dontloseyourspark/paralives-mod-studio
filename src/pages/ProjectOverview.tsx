import { useProjectWorkspace } from '../hooks/useProjectWorkspace'
import WorkspaceHeader from '../components/WorkspaceHeader'
import WorkspaceCanvas from '../components/WorkspaceCanvas'

export default function ProjectOverview() {
  const {
    currentProject,
    selectedItemId,
    selectedNodeKey,
    activeSelectedItem,
    activeSelectedNode,
    isSaving,
    isRehydrating,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    updateProject,
    updateItem,
    handleAddNewItem,
    handleAddChildNode,
    handleRemoveChildNode,
    handleDeleteItem,
    handleSelectItem,
    handleDeselectItem,
    handleSelectNode,
    handleClearNode,
    handleWizardAdvancedEditing,
    handleSaveProject,
    handleBackToDashboard,
  } = useProjectWorkspace()

  if (isRehydrating) {
    return (
      <div className="min-h-screen bg-[#0e1017] text-gray-500 flex items-center justify-center text-xs">
        Synchronizing project workspace profile...
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-[#0e1017] text-gray-400 flex flex-col items-center justify-center gap-4">
        <p className="text-sm">No active mod project loaded in workspace context.</p>
        <button
          onClick={handleBackToDashboard}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white text-xs font-semibold cursor-pointer transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#0e1017] text-white flex flex-col select-none overflow-hidden box-border">
      <WorkspaceHeader
        project={currentProject}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onBack={handleBackToDashboard}
        onSave={handleSaveProject}
        onProjectChange={updateProject}
      />

      <WorkspaceCanvas
        project={currentProject}
        items={currentProject.items}
        selectedItemId={selectedItemId}
        selectedNodeKey={selectedNodeKey}
        activeSelectedItem={activeSelectedItem}
        activeSelectedNode={activeSelectedNode}
        onSelectItem={handleSelectItem}
        onDeselectItem={handleDeselectItem}
        onSelectNode={handleSelectNode}
        onClearNode={handleClearNode}
        onAddItem={handleAddNewItem}
        onAddChildNode={handleAddChildNode}
        onRemoveChildNode={handleRemoveChildNode}
        onDeleteItem={handleDeleteItem}
        onSaveItem={updateItem}
        onWizardAdvancedEditing={handleWizardAdvancedEditing}
        onProjectChange={updateProject}
      />
    </div>
  )
}
