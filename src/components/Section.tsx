import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import './Section.css'

type PaperColor =
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'
  | 'pink' | 'brown' | 'kraft' | 'white' | 'gray' | 'black'

type PaperStyle = 'solid' | 'lined' | 'clear'

interface SectionProps {
  width: number
  height: number
  color?: PaperColor
  style?: PaperStyle
  children?: ReactNode
}

const TORN_MASK = (seed: number) =>
  `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><defs><filter id='t'><feTurbulence type='fractalNoise' baseFrequency='0.008 0.025' numOctaves='2' seed='${seed}' result='n'/><feDisplacementMap in='SourceGraphic' in2='n' scale='40' xChannelSelector='R' yChannelSelector='G'/></filter></defs><rect width='100%' height='100%' filter='url(%23t)'/></svg>")`

function Section({ width, height, color = 'white', style = 'solid', children }: SectionProps) {
  const [seed] = useState(() => Math.floor(Math.random() * 100000))
  const tornMask = useMemo(() => TORN_MASK(seed), [seed])

  return (
    <div
      className={`section section-${style}`}
      style={{
        '--section-width': width,
        '--section-height': height,
        '--torn-mask': tornMask,
        '--section-bg': `var(--paper-${color})`,
      } as CSSProperties}
    >
      <div className="section-inner">
        {children}
      </div>
    </div>
  )
}

export default Section
