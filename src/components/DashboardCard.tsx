interface DashboardCardProps {
  icon: string
  text: string
  onClick: () => void
}

export default function DashboardCard({ icon, text, onClick }: DashboardCardProps) {
  return (
    <button className="action-button" onClick={onClick}>
      <span className="button-icon">{icon}</span>
      <span className="button-text">{text}</span>
    </button>
  )
}
