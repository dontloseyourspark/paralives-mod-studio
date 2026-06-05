import type { ReactNode } from 'react'

interface DashboardCardProps {
  icon: ReactNode
  text: string
  description?: string
  onClick: () => void
}

export default function DashboardCard({ icon, text, description, onClick }: DashboardCardProps) {
  return (
    <button className="action-button" onClick={onClick}>
      <span className="button-icon">{icon}</span>
      <div className="button-text-wrap">
        <span className="button-text">{text}</span>
        {description && <span className="button-desc">{description}</span>}
      </div>
    </button>
  )
}
