import { useNavigate } from 'react-router-dom'
import { useModStore } from '../store/useModStore'
import DashboardCard from '../components/DashboardCard'
import type { ModProject } from '../types'
import '../styles/Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const createProject = useModStore((s) => s.createProject)
  const recentProjects = useModStore((s) => s.recentProjects)
  const setProject = useModStore((s) => s.setProject)

  const handleCreateMod = () => {
    const project = createProject()
    navigate(`/project/${project.id}`)
  }

  const handleOpenMod = () => {
    console.log('Open existing mod')
  }

  const handleOpenProject = (project: ModProject) => {
    setProject(project)
    navigate(`/project/${project.id}`)
  }

  const handleImportMod = () => {
    console.log('Import mod')
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
      </div>

      <section className="dashboard-info">
        <p>Only items are supported at this moment. Other mod-focused features will be added soon.</p>
      </section>

      <section className="actions">
        <div className="actions-grid">
          <DashboardCard icon="+" text="Create New Mod" onClick={handleCreateMod} />
          <DashboardCard icon="+" text="Open Existing Mod" onClick={handleOpenMod} />
          <DashboardCard icon="+" text="Import Mod" onClick={handleImportMod} />
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
                <h3>{project.name}</h3>
                <p className="project-path">{project.description}</p>
                <p className="project-date">
                  Last modified: {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
