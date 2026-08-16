import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import SideMenu from './components/SideMenu'
import ThemeToggle from './components/ThemeToggle'
import Gap from './components/Gap'
import Ada from './ada/Ada'
import './App.css'

type Theme = 'light' | 'dark'

function Home() {
  return (
    <div className="graph-paper">
      <h1>William Dann</h1>
      <Gap lines={1} />

      <h2>About Me</h2>
      <Gap lines={1} />
      <p>I am a <b>Software Engineer</b> and <b>Chess Player</b> located in Seattle.</p>
      <Gap lines={1} />
      <p><a href="https://www.github.com/WilliamDann">GitHub</a> <a href="https://www.github.com/WilliamDann">LinkedIn</a>
      </p>
      <Gap lines={1} />

      <h2>Featured</h2>
      <Gap lines={1} />

      <h3>Chess Engine</h3>
      <p>I wrote a chess engine in go, it's pretty good! Play it here:</p><br />
      <Link to="/ada">Play Ada</Link>

    </div>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(
    () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  )

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      localStorage.setItem('theme', next)
      return next
    })
  }

  return (
    <>
      <SideMenu open={menuOpen} onToggle={() => setMenuOpen(o => !o)}
        footer={<ThemeToggle theme={theme} onToggle={toggleTheme} />}>
        <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
        <Link to="/ada" onClick={() => setMenuOpen(false)}>AdaEngine</Link>
        <a href="https://www.github.com/WilliamDann">GitHub</a>
      </SideMenu>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ada" element={<Ada menuOpen={menuOpen} />} />
      </Routes>
    </>
  )
}

export default App
