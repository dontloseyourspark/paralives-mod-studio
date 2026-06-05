import { Routes, Route } from 'react-router-dom'

import Dashboard from '../pages/Dashboard'
import ProjectOverview from '../pages/ProjectOverview'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/project/:id" element={<ProjectOverview />} />
    </Routes>
  )
}
