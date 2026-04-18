import { useEffect, useRef, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Wrench,
  UserX,
  CloudRain,
  Users,
  Radio,
  Zap,
  Database,
  Star,
  RefreshCw,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const CLIP = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))'
const RED = '#EE3F2C'

const TEAM_COLORS: Record<string, string> = {
  mclaren: '#FF8000',
  red_bull: '#3671C6',
  ferrari: '#E8002D',
  mercedes: '#27F4D2',
  aston_martin: '#358C75',
  alpine: '#FF87BC',
  williams: '#64C4FF',
  haas: '#B6BABD',
  rb: '#6692FF',
  sauber: '#52E252',
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function ClipButton({
  children,
  variant = 'red',
  to,
  onClick,
  size = 'md',
}: {
  children: React.ReactNode
  variant?: 'red' | 'outline'
  to?: string
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}) {
  const pad =
    size === 'sm' ? 'px-4 py-2 text-xs' : size === 'lg' ? 'px-10 py-4 text-sm' : 'px-7 py-3 text-sm'
  const base = `inline-flex items-center justify-center font-semibold uppercase tracking-widest transition-opacity duration-200 hover:opacity-80 cursor-pointer select-none ${pad}`
  const faceClass =
    variant === 'red'
      ? 'text-white'
      : 'bg-transparent text-white border border-white/60'
  const faceStyle: React.CSSProperties =
    variant === 'red' ? { background: RED, clipPath: CLIP } : { clipPath: CLIP }
  const el = (
    <span className={`${base} ${faceClass}`} style={faceStyle} onClick={onClick}>
      {children}
    </span>
  )
  if (to) return <Link to={to} style={{ textDecoration: 'none' }}>{el}</Link>
  return el
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useFadeIn(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return {
    ref,
    fadeStyle: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(30px)',
      transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
    } as React.CSSProperties,
  }
}

function useCountUp(target: number, duration: number, started: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!started) return
    let rafId: number
    let startTime: number | null = null
    const step = (ts: number) => {
      if (startTime === null) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) rafId = requestAnimationFrame(step)
      else setCount(target)
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [started, target, duration])
  return count
}

// ─── Scroll helper ────────────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function F1SimLogo({ height = 32 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <img
        src="/f1-logo.png"
        alt="Formula 1"
        style={{ height: `${height}px`, width: 'auto', display: 'block' }}
      />
      <span
        className="font-black uppercase"
        style={{ fontSize: '18px', color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}
      >
        SIM
      </span>
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: 'What-If', id: 'whatif' },
    { label: 'How It Works', id: 'howitworks' },
    { label: 'Live 2026', id: 'live' },
  ]

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(0,0,0,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : 'none',
      }}
    >
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="cursor-pointer bg-transparent border-none p-0"
      >
        <F1SimLogo />
      </button>

      <div className="hidden md:flex items-center gap-1">
        {navLinks.map(({ label, id }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              padding: '8px 12px',
              borderRadius: '4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(255,255,255,0.08)'
              el.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'transparent'
              el.style.color = 'rgba(255,255,255,0.7)'
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative w-full overflow-hidden" style={{ height: '100svh' }}>
      {/* Video — full opacity, no filters */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: 1, filter: 'none', zIndex: 0,
        }}
      >
        <source src="/f1-hero.mp4" type="video/mp4" />
      </video>

      {/* Copy — upper left */}
      <div
        className="relative flex flex-col justify-start"
        style={{ zIndex: 1, paddingTop: '18vh', paddingLeft: 'clamp(2rem, 6vw, 6rem)', maxWidth: '680px' }}
      >
        <h1
          className="font-black uppercase leading-none"
          style={{ fontSize: 'clamp(42px, 6vw, 72px)', letterSpacing: '-0.04em' }}
        >
          <span style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>PREDICT THE</span>
          <span style={{ color: RED, display: 'block' }}>CHAMPIONSHIP</span>
        </h1>
        <p
          className="mt-5 font-normal"
          style={{ color: 'rgba(255,255,255,0.7)', fontSize: '18px', lineHeight: '1.6', maxWidth: '480px' }}
        >
          Monte Carlo simulation engine. 10,000 season simulations.
          Real FastF1 data. Who wins?
        </p>
      </div>

      {/* Single CTA — centered bottom */}
      <Link
        to="/dashboard"
        style={{
          position: 'absolute',
          bottom: '88px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          display: 'inline-flex',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.2)',
          clipPath: CLIP,
          padding: '16px 40px',
          color: '#fff',
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          ; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.4)'
        }}
        onMouseLeave={(e) => {
          ; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)'
        }}
      >
        GO TO DASHBOARD →
      </Link>

      {/* Bounce scroll indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(255,255,255,0.35)',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          scroll
        </span>
        <svg
          className="bounce-chevron"
          width="16"
          height="10"
          viewBox="0 0 16 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1L8 8L15 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const { ref, fadeStyle } = useFadeIn()

  const steps = [
    {
      num: '01',
      title: 'Real Data',
      desc: 'FastF1 telemetry + Jolpica API. Every lap, every sector, 2018–2026. 1,984 race results.',
    },
    {
      num: '02',
      title: 'Monte Carlo',
      desc: '10,000 season simulations in under 2 seconds. Randomness, DNFs, safety cars, tyre strategy — all modelled.',
    },
    {
      num: '03',
      title: 'Probability',
      desc: 'Not just who wins. Who has a 73% chance. Which circuit favours which driver. Updated after every race.',
    },
  ]

  return (
    <section
      id="howitworks"
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: '#000', padding: '100px 0' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>
        <p className="font-semibold uppercase tracking-widest mb-3" style={{ color: RED, fontSize: '12px' }}>
          The Engine
        </p>
        <h2
          className="font-black uppercase mb-16"
          style={{ fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.04em', color: '#fff' }}
        >
          How It Works
        </h2>

        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {steps.map((step, i) => (
            <Fragment key={step.num}>
              <div
                style={{
                  flex: 1,
                  padding: '36px 32px',
                  background: '#0d0d0d',
                  borderTop: `2px solid ${RED}`,
                  transition: 'transform 0.3s ease, background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(-4px)'
                  el.style.background = '#161616'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(0)'
                  el.style.background = '#0d0d0d'
                }}
              >
                <span
                  className="font-black"
                  style={{ fontSize: '48px', color: RED, letterSpacing: '-0.04em', lineHeight: 1 }}
                >
                  {step.num}
                </span>
                <h3
                  className="font-bold uppercase mt-4 mb-3"
                  style={{ fontSize: '18px', color: '#fff', letterSpacing: '-0.02em' }}
                >
                  {step.title}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: '1.6' }}>
                  {step.desc}
                </p>
              </div>

              {i < steps.length - 1 && (
                <div
                  className="hidden md:flex"
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: '48px',
                    color: 'rgba(255,255,255,0.2)',
                    fontSize: '22px',
                    fontWeight: 300,
                  }}
                >
                  →
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── What-If ──────────────────────────────────────────────────────────────────

function WhatIf() {
  const { ref, fadeStyle } = useFadeIn()

  const scenarios: Array<{ title: string; icon: LucideIcon; desc: string; badge: string }> = [
    {
      title: 'Driver Swap',
      icon: ArrowLeftRight,
      desc: 'Drag drivers between teams and see how car advantage changes the championship.',
      badge: 'Sainz → Red Bull: +12% WDC',
    },
    {
      title: 'Reliability Fix',
      icon: Wrench,
      desc: 'Remove mechanical failures from a team. How much did Ferrari cost Leclerc in 2022?',
      badge: 'Ferrari 2022: Leclerc +22%',
    },
    {
      title: 'Remove Driver',
      icon: UserX,
      desc: 'Injury, ban, or retirement — who steps up when a champion is gone?',
      badge: 'No Verstappen: Norris wins',
    },
    {
      title: 'Weather Change',
      icon: CloudRain,
      desc: 'Force wet conditions across the calendar. Reveals hidden wet-weather talent.',
      badge: 'All wet: Hamilton +15%',
    },
    {
      title: 'Team Orders',
      icon: Users,
      desc: 'Free both teammates to race — no more stacking points for the faster driver.',
      badge: 'Free Perez: VER -8%',
    },
    {
      title: 'Live Season',
      icon: Radio,
      desc: 'Freeze current standings and simulate only the remaining 2026 races.',
      badge: 'Norris wins: 67% probability',
    },
  ]

  return (
    <section
      id="whatif"
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: '#0a0a0a', padding: '100px 0' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>
        <p className="font-semibold uppercase tracking-widest mb-3" style={{ color: RED, fontSize: '12px' }}>
          Scenario Engine
        </p>
        <h2
          className="font-black uppercase mb-3"
          style={{ fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.04em', color: '#fff' }}
        >
          What-If Scenarios
        </h2>
        <p className="mb-16" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '17px' }}>
          Rewrite F1 history. Predict alternate futures.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2px',
          }}
        >
          {scenarios.map((s) => {
            const IconComp = s.icon
            return (
              <Link
                key={s.title}
                to="/what-if"
                style={{
                  background: '#111',
                  borderLeft: `3px solid ${RED}`,
                  padding: '28px 24px',
                  transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'block',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.transform = 'translateY(-6px)'
                  el.style.background = '#1a1a1a'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.transform = 'translateY(0)'
                  el.style.background = '#111'
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: RED,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    flexShrink: 0,
                  }}
                >
                  <IconComp size={18} color="#fff" />
                </div>
                <h3
                  className="font-bold uppercase mb-3"
                  style={{ fontSize: '15px', color: '#fff', letterSpacing: '-0.01em' }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    marginBottom: '16px',
                  }}
                >
                  {s.desc}
                </p>
                <span
                  style={{
                    background: 'rgba(238,63,44,0.12)',
                    border: `1px solid ${RED}`,
                    color: RED,
                    fontSize: '11px',
                    padding: '4px 10px',
                    letterSpacing: '0.03em',
                    display: 'inline-flex',
                  }}
                >
                  {s.badge}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Data Sources ─────────────────────────────────────────────────────────────

function DataSources() {
  const { ref, fadeStyle } = useFadeIn()

  const sources: Array<{ stat: string; label: string; desc: string; icon: LucideIcon }> = [
    {
      stat: '51,028',
      label: 'Laps Analysed',
      desc: 'FastF1 telemetry — sector times, tyre compounds, pace per lap, 2018–2026.',
      icon: Zap,
    },
    {
      stat: '1,984',
      label: 'Race Results',
      desc: 'Jolpica/Ergast historical results, qualifying, and sprint data 2015–2026.',
      icon: Database,
    },
    {
      stat: '42',
      label: 'Rated Drivers',
      desc: 'Per-season driver ratings: pace, consistency, wet-weather skill, DNF rate.',
      icon: Star,
    },
    {
      stat: 'Weekly',
      label: 'Data Updates',
      desc: 'Standings, results, and simulation probabilities refreshed after every race weekend.',
      icon: RefreshCw,
    },
  ]

  return (
    <section
      id="data"
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: '#000', padding: '100px 0' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>
        <p className="font-semibold uppercase tracking-widest mb-3" style={{ color: RED, fontSize: '12px' }}>
          Data Sources
        </p>
        <h2
          className="font-black uppercase mb-16"
          style={{ fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.04em', color: '#fff' }}
        >
          The Data Behind It
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '2px',
          }}
        >
          {sources.map((s) => {
            const IconComp = s.icon
            return (
              <div
                key={s.label}
                style={{
                  background: '#0a0a0a',
                  borderTop: `3px solid ${RED}`,
                  padding: '36px 28px',
                }}
              >
                <IconComp size={22} color={RED} />
                <div
                  className="font-black"
                  style={{
                    fontSize: 'clamp(28px, 3vw, 42px)',
                    color: RED,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    marginTop: '18px',
                    marginBottom: '6px',
                  }}
                >
                  {s.stat}
                </div>
                <div
                  className="font-bold uppercase"
                  style={{ fontSize: '13px', color: '#fff', letterSpacing: '0.05em', marginBottom: '10px' }}
                >
                  {s.label}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.55' }}>
                  {s.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Live 2026 ────────────────────────────────────────────────────────────────

interface StandingsDriver {
  driver_name: string
  constructor: string
  points: number
}

function Live2026() {
  const { ref, fadeStyle } = useFadeIn()
  const [drivers, setDrivers] = useState<StandingsDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const maxPts = drivers[0]?.points || 1

  useEffect(() => {
    axios
      .get('/api/v1/scenarios/current-standings?season=2026')
      .then((r) => {
        setDrivers((r.data.drivers || []).slice(0, 5))
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const teamColor = (con: string) =>
    TEAM_COLORS[con?.toLowerCase().replace(/[^a-z_]/g, '')] ?? '#888'

  return (
    <section
      id="live"
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: '#000', padding: '100px 0' }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
        <div className="flex items-center gap-3 mb-3">
          <span
            className="live-dot"
            style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}
          />
          <p className="font-semibold uppercase tracking-widest" style={{ color: RED, fontSize: '12px' }}>
            Live Data
          </p>
        </div>
        <h2
          className="font-black uppercase mb-2"
          style={{ fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '-0.04em', color: '#fff' }}
        >
          Live 2026 Championship
        </h2>
        <p className="mb-10" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}>
          Updated after every race weekend
        </p>

        <div style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 140px 80px',
              padding: '10px 16px',
              background: '#0a0a0a',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {['POS', 'DRIVER', 'TEAM', 'PTS'].map((h) => (
              <span
                key={h}
                style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em' }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Skeleton */}
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 140px 80px',
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                {Array.from({ length: 4 }).map((_, j) => (
                  <div
                    key={j}
                    style={{
                      height: '14px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '2px',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
              </div>
            ))}

          {!loading && (error || drivers.length === 0) && (
            <div
              style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}
            >
              2026 season data not yet available — seed the database first.
            </div>
          )}

          {!loading &&
            drivers.map((d, i) => (
              <div
                key={d.driver_name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 140px 80px',
                  padding: '14px 16px',
                  borderBottom: i < drivers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  alignItems: 'center',
                  background: i === 0 ? 'rgba(238,63,44,0.04)' : 'transparent',
                }}
              >
                <span
                  className="font-black"
                  style={{ fontSize: '18px', color: i === 0 ? RED : 'rgba(255,255,255,0.3)', letterSpacing: '-0.04em' }}
                >
                  {i + 1}
                </span>
                <span className="font-semibold text-white" style={{ fontSize: '15px' }}>
                  {d.driver_name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: teamColor(d.constructor),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{d.constructor}</span>
                </div>
                <div>
                  <span className="font-bold text-white" style={{ fontSize: '15px' }}>
                    {d.points}
                  </span>
                  <div
                    style={{
                      height: '2px',
                      background: 'rgba(255,255,255,0.08)',
                      marginTop: '4px',
                      borderRadius: '1px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(d.points / maxPts) * 100}%`,
                        background: RED,
                        borderRadius: '1px',
                        transition: 'width 0.8s ease-out',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="flex justify-center mt-10">
          <ClipButton to="/simulate" variant="red">
            Full Simulation →
          </ClipButton>
        </div>
      </div>
    </section>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatItem({ target, label, i }: { target: number; label: string; i: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const count = useCountUp(target, 1500, started)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.4 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        padding: '40px 24px',
        textAlign: 'center',
        borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none',
      }}
    >
      <div
        className="font-black"
        style={{ fontSize: 'clamp(28px, 3vw, 40px)', letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}
      >
        {count.toLocaleString()}
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.75)',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginTop: '6px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function StatsBar() {
  const { ref, fadeStyle } = useFadeIn()

  const stats = [
    { target: 1984, label: 'Race Results' },
    { target: 10000, label: 'Sims / Run' },
    { target: 9, label: 'Seasons of Data' },
    { target: 6, label: 'Scenario Types' },
  ]

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: RED, padding: '0' }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
      >
        {stats.map((s, i) => (
          <StatItem key={s.label} target={s.target} label={s.label} i={i} />
        ))}
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      style={{
        background: '#000',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '48px 2rem 32px',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '32px',
        }}
      >
        <div>
          <div className="mb-3">
            <F1SimLogo height={24} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            Monte Carlo Championship Simulator
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <a
            href="https://github.com/yuggandhii"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}
            className="hover:text-white transition-colors"
          >
            GitHub →
          </a>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '6px' }}>
            Built with FastAPI + React + NumPy
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1100px',
          margin: '32px auto 0',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.2)',
          fontSize: '11px',
          letterSpacing: '0.04em',
        }}
      >
        Not affiliated with Formula 1 or FOM · Data via FastF1 &amp; Jolpica
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div style={{ fontFamily: 'Rubik, sans-serif', background: '#000', color: '#fff' }}>
      <Navbar />
      <Hero />
      <HowItWorks />
      <WhatIf />
      <DataSources />
      <Live2026 />
      <StatsBar />
      <Footer />
    </div>
  )
}
