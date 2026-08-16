import './PullTab.css'

interface PullTabProps {
  open: boolean
  onClick: () => void
  label?: string
}

function PullTab({ open, onClick, label }: PullTabProps) {
  return (
    <button
      className={`menu-tab${open ? ' open' : ''}`}
      onClick={onClick}
      aria-label={label ?? (open ? 'Close menu' : 'Open menu')}
    >
      <span className="chevron"></span>
    </button>
  )
}

export default PullTab
