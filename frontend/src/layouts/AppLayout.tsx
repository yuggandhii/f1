import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Play, Shuffle, Gamepad2,
} from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import { useSeason } from '../contexts/SeasonContext'

const AMBER = '#F5A623'
const SEASONS = [2021, 2022, 2023, 2024, 2025, 2026]

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', num: '01' },
  { label: 'Simulate',  icon: Play,            to: '/simulate',  num: '02' },
  { label: 'What-If',   icon: Shuffle,          to: '/what-if',   num: '03' },
  { label: 'Game',      icon: Gamepad2,         to: '/game',      num: '05' },
]

export default function AppLayout() {
  const location = useLocation()
  const { season, setSeason } = useSeason()
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light'

  const [clockNow, setClockNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const clockTime = (() => {
    try {
      return clockNow.toLocaleTimeString('en-GB', {
        hour12: false, timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } catch { return clockNow.toLocaleTimeString() }
  })()
  const clockDate = (() => {
    try {
      return clockNow.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
      }).replace(/\//g, '-')
    } catch { return '' }
  })()

  const navBg   = isDark ? '#13151a' : '#ffffff'
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const textDim = isDark ? 'rgba(231,229,224,0.45)' : 'rgba(15,15,15,0.45)'
  const textFull= isDark ? '#e7e5e0' : '#0f1012'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: '44px',
        background: navBg,
        borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'stretch',
        padding: 0,
      }}>
        {/* Logo */}
        <Link to="/" style={{
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '9px',
          padding: '0 18px', borderRight: `1px solid ${border}`, flexShrink: 0,
        }}>
          <div style={{ width: 16, height: 16, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, border: `1.5px solid ${AMBER}` }} />
            <div style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, background: AMBER }} />
          </div>
          <span className="pw-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: textFull }}>
            PITWALL<span style={{ color: AMBER }}>/</span>SIM
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {NAV.map(({ label, to, num }) => {
            const active = location.pathname === to ||
              (to === '/dashboard' && location.pathname.startsWith('/drivers'))
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0 16px', textDecoration: 'none',
                  color: active ? textFull : textDim,
                  borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
                  fontSize: 11, fontWeight: 500,
                  background: active ? (isDark ? 'rgba(245,166,35,0.10)' : 'rgba(245,166,35,0.08)') : 'transparent',
                  transition: 'color 150ms ease, background 150ms ease',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.color = textFull
                    el.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.color = textDim
                    el.style.background = 'transparent'
                  }
                }}
              >
                <span className="pw-mono" style={{ fontSize: 8, color: isDark ? 'rgba(231,229,224,0.28)' : 'rgba(15,15,15,0.28)', marginRight: 2 }}>
                  {num}
                </span>
                {label}
              </Link>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right: season selector + theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 14px', borderLeft: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {SEASONS.map(s => {
              const on = s === season
              return (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className="pw-mono"
                  style={{
                    padding: '3px 8px', fontSize: 10,
                    background: on ? AMBER : 'transparent',
                    color: on ? (isDark ? '#0b0c0e' : '#fff') : textDim,
                    border: `1px solid ${on ? AMBER : border}`,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 120ms ease',
                  }}
                >
                  {s}{s === 2026 && <span style={{ marginLeft: 3, fontSize: 7, color: on ? '#0b0c0e' : '#4ADE80' }}>●</span>}
                </button>
              )
            })}
          </div>
          <div style={{ width: 1, height: 18, background: border, marginLeft: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '0 6px', gap: 1 }}>
            <span className="pw-mono" style={{
              fontSize: 8, color: AMBER, fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.06em',
            }}>
              {clockDate}
            </span>
            <span className="pw-mono" style={{
              fontSize: 13, color: AMBER, fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
            }}>
              {clockTime}
            </span>
          </div>
          <div style={{ width: 1, height: 18, background: border }} />
          <ThemeToggle fixed={false} />
        </div>
      </nav>

      {/* Page content */}
      <div style={{ paddingTop: '44px', minHeight: '100vh' }} className="page-enter">
        <Outlet />
      </div>
    </div>
  )
}
