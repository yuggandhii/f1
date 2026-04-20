import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('f1sim:theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('f1sim:theme', theme)
}

export function ThemeToggle({ fixed = true }: { fixed?: boolean }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const t = getInitialTheme()
    applyTheme(t)
    setTheme(t)
  }, [])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        position: fixed ? 'fixed' : 'relative',
        top: fixed ? '12px' : undefined,
        right: fixed ? '16px' : undefined,
        zIndex: 50,
        width: '36px',
        height: '36px',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 200ms ease, border-color 200ms ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'rgba(238,63,44,0.12)'
        el.style.borderColor = 'var(--border-hover)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'rgba(255,255,255,0.05)'
        el.style.borderColor = 'var(--border)'
      }}
    >
      {theme === 'dark'
        ? <Sun size={16} color="var(--text-secondary)" />
        : <Moon size={16} color="var(--text-secondary)" />
      }
    </button>
  )
}
