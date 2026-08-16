import type { CSSProperties } from 'react'
import './Gap.css'

interface GapProps {
  lines: number
}

function Gap({ lines }: GapProps) {
  return (
    <div
      className="gap"
      style={{ '--gap-lines': lines } as CSSProperties}
      aria-hidden="true"
    />
  )
}

export default Gap
