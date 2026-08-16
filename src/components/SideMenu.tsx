import type { ReactNode } from 'react'
import PullTab from './PullTab'
import './SideMenu.css'

interface SideMenuProps {
  open: boolean
  onToggle: () => void
  children?: ReactNode
  footer?: ReactNode
}

function SideMenu({ open, onToggle, children, footer }: SideMenuProps) {
  return (
    <nav className={`menu${open ? ' open' : ''}`}>
      <PullTab open={open} onClick={onToggle} />
      <div className="menu-content">{children}</div>
      {footer && <div className="menu-footer">{footer}</div>}
    </nav>
  )
}

export default SideMenu
