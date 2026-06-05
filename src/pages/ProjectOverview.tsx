import { useState } from 'react'
import { useModStore } from '../store/useModStore'
import ItemEditor from '../components/ItemEditor'
import '../styles/Dashboard.css'

export default function ProjectOverview() {
  const project = useModStore((s) => s.currentProject)
  const updateProject = useModStore((s) => s.updateProject)
  
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')

  if (!project) {
    return <div className="project-overview"><p>No project loaded.</p></div>
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    updateProject({ name: newName })
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value
    setDescription(newDescription)
    updateProject({ description: newDescription })
  }

  return (
    <div className="project-overview">
      <div className="project-header">
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          className="project-name-input"
          placeholder="Project Name"
        />
        <textarea
          value={description}
          onChange={handleDescriptionChange}
          className="project-description-input"
          placeholder="Project Description"
        />
      </div>

      <section className="project-items">
        <h2>Items</h2>
        <ItemEditor />
      </section>
    </div>
  )
}
