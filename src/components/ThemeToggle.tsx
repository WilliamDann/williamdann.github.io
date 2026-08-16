import './ThemeToggle.css'

interface ThemeToggleProps {
  theme: 'light' | 'dark'
  onToggle: () => void
}

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      className="theme-toggle-btn"
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <svg className="theme-toggle-icon">
        <use href={`/icons.svg#${theme === 'dark' ? 'sun-icon' : 'moon-icon'}`} />
      </svg>
    </button>
  )
}

export default ThemeToggle
