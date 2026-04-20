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
  Gauge,
  Sliders,
  Trophy,
  Target,
  BarChart3,
  Gamepad2,
  Timer,
  TrendingUp,
  Activity,
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
    { label: 'How It Works', id: 'howitworks' },
    { label: 'Simulation', id: 'simulation' },
    { label: 'What-If', id: 'whatif' },
    { label: 'Game', id: 'game' },
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
        style={{ zIndex: 1, paddingTop: '18vh', paddingLeft: 'clamp(2rem, 6vw, 6rem)', maxWidth: '720px' }}
      >
        <div style={{ marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-block',
              background: RED,
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              padding: '5px 14px',
              textTransform: 'uppercase',
              clipPath: CLIP,
            }}
          >
            MONTE CARLO CHAMPIONSHIP SIMULATOR
          </span>
        </div>
        <h1
          className="font-black uppercase leading-none"
          style={{ fontSize: 'clamp(48px, 7vw, 84px)', letterSpacing: '-0.04em' }}
        >
          <span style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>PITWALL</span>
          <span style={{ color: '#F5A623', display: 'block', fontSize: '0.55em', letterSpacing: '0.02em' }}>/SIM</span>
        </h1>
        <p
          className="mt-5 font-normal"
          style={{ color: 'rgba(255,255,255,0.75)', fontSize: '18px', lineHeight: '1.7', maxWidth: '520px' }}
        >
          Rewrite F1 history. Simulate 50,000 championship seasons in under 2 seconds.
          Real telemetry from every lap since 2018. Nine driver ratings.
          Every safety car, every tyre strategy, every DNF — modelled.
        </p>
        <p
          className="mt-3 font-medium"
          style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', letterSpacing: '0.04em' }}
        >
          Built by Yug Gandhi & Ansh Agarwal
        </p>
      </div>

      {/* CTA buttons — bottom center */}
      <div
        style={{
          position: 'absolute',
          bottom: '88px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: RED,
            clipPath: CLIP,
            padding: '14px 36px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
        >
          OPEN DASHBOARD →
        </Link>
        <Link
          to="/simulate"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.25)',
            clipPath: CLIP,
            padding: '14px 36px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'border-color 0.2s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.5)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.25)' }}
        >
          RUN SIMULATION
        </Link>
      </div>

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
      title: 'Ingest Real Data',
      icon: Database,
      desc: 'FastF1 telemetry + Jolpica API. Every lap time, sector split, tyre compound, and pit stop from 2018–2026. Over 51,000 laps and 1,984 race results ingested into PostgreSQL.',
    },
    {
      num: '02',
      title: 'Rate Every Driver',
      icon: Target,
      desc: '9 metrics per driver per season: base pace, consistency, wet skill, tyre management, overtake ability, qualifying edge, speed rating, pit efficiency, and teammate index — all normalised 0.0–1.0.',
    },
    {
      num: '03',
      title: 'Monte Carlo Engine',
      icon: Activity,
      desc: 'Run 1,000 to 50,000 season simulations in parallel. Each race models qualifying, lap-1 incidents, safety cars, tyre degradation, DNFs, grid penalties, and weather. All in under 2 seconds.',
    },
    {
      num: '04',
      title: 'Probabilistic Output',
      icon: BarChart3,
      desc: 'Not just "who wins" — every driver gets a WDC probability, expected points, standard deviation, P5/P95 confidence range, podium rate, and per-race win probability.',
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
          The Pipeline
        </p>
        <h2
          className="font-black uppercase mb-4"
          style={{ fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.04em', color: '#fff' }}
        >
          How It Works
        </h2>
        <p className="mb-16" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px', maxWidth: '600px' }}>
          From raw telemetry to championship probabilities — four stages, fully automated.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2px' }}>
          {steps.map((step) => {
            const IconComp = step.icon
            return (
              <div
                key={step.num}
                style={{
                  padding: '36px 28px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span
                    className="font-black"
                    style={{ fontSize: '36px', color: RED, letterSpacing: '-0.04em', lineHeight: 1 }}
                  >
                    {step.num}
                  </span>
                  <IconComp size={20} color="rgba(255,255,255,0.4)" />
                </div>
                <h3
                  className="font-bold uppercase mb-3"
                  style={{ fontSize: '16px', color: '#fff', letterSpacing: '-0.02em' }}
                >
                  {step.title}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', lineHeight: '1.65' }}>
                  {step.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Simulation Parameters ────────────────────────────────────────────────────

function SimulationShowcase() {
  const { ref, fadeStyle } = useFadeIn()

  const params = [
    {
      icon: Gauge,
      label: 'ITERATIONS',
      value: '1,000 – 50,000',
      detail: 'More iterations = more precise probabilities. Default: 10,000 runs per simulation. 50,000 for research-grade accuracy.',
    },
    {
      icon: Sliders,
      label: 'CHAOS FACTOR',
      value: '0.05 – 0.50',
      detail: 'Controls randomness. Low (0.05) = car dominates, predictable seasons. High (0.50) = anything can happen, wild upsets every race.',
    },
    {
      icon: Timer,
      label: 'DATA RANGE',
      value: '2018 – 2026',
      detail: 'Choose which seasons feed driver ratings. Narrow range (2025–2026) = current form only. Wide range (2018–2026) = career-long consistency.',
    },
    {
      icon: CloudRain,
      label: 'WEATHER MODE',
      value: '4 modes',
      detail: 'Historical (real weather), All Dry, Random (50% wet chance), or Monsoon (every race wet). Reveals hidden wet-weather talent.',
    },
    {
      icon: Wrench,
      label: 'RELIABILITY',
      value: '3 profiles',
      detail: 'Historical (real DNF rates), Optimistic (halved), or Pessimistic (doubled). See how Ferrari\'s 2022 reliability cost Leclerc the title.',
    },
    {
      icon: TrendingUp,
      label: 'CUTOFF ROUND',
      value: 'Round 1 – 24',
      detail: 'Simulate only the first N races, or the entire season. Perfect for "what if the season ended at round 10?" scenarios.',
    },
  ]

  return (
    <section
      id="simulation"
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: '#0a0a0a', padding: '100px 0' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>
        <p className="font-semibold uppercase tracking-widest mb-3" style={{ color: RED, fontSize: '12px' }}>
          Full Control
        </p>
        <h2
          className="font-black uppercase mb-4"
          style={{ fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.04em', color: '#fff' }}
        >
          Simulation Parameters
        </h2>
        <p className="mb-16" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px', maxWidth: '620px' }}>
          Every knob is yours to turn. Configure iterations, chaos, weather, reliability, data range, and cutoff round before every run.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2px' }}>
          {params.map((p) => {
            const IconComp = p.icon
            return (
              <div
                key={p.label}
                style={{
                  background: '#111',
                  padding: '28px 24px',
                  borderLeft: `3px solid ${RED}`,
                  transition: 'transform 0.3s ease, background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateX(4px)'
                  el.style.background = '#1a1a1a'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateX(0)'
                  el.style.background = '#111'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <IconComp size={18} color={RED} />
                  <span
                    className="font-bold uppercase"
                    style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}
                  >
                    {p.label}
                  </span>
                </div>
                <div className="font-black" style={{ fontSize: '22px', color: '#fff', letterSpacing: '-0.02em', marginBottom: '8px' }}>
                  {p.value}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.6' }}>
                  {p.detail}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex justify-center mt-12">
          <ClipButton to="/simulate" variant="red" size="lg">
            Configure & Run Simulation →
          </ClipButton>
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
      desc: 'Move any driver to a different team\'s car. Keep their ratings, inherit the new car\'s performance. What if Sainz drove the Red Bull?',
      badge: 'Sainz → Red Bull: +12% WDC',
    },
    {
      title: 'Reliability Fix',
      icon: Wrench,
      desc: 'Remove mechanical failures from a team. We split DNFs into driver errors vs factory failures — so you see the true cost of unreliability.',
      badge: 'Ferrari 2022: Leclerc +22%',
    },
    {
      title: 'Remove Driver',
      icon: UserX,
      desc: 'Simulate injury, ban, or retirement for N rounds. Who fills the gap? Which teammate benefits most from reduced competition?',
      badge: 'No Verstappen: Norris wins',
    },
    {
      title: 'Weather Override',
      icon: CloudRain,
      desc: 'Force wet conditions at any circuit. Spa, Monaco, Suzuka — all soaked. Reveals hidden wet-weather talent buried in dry-season stats.',
      badge: 'All wet: Hamilton +15%',
    },
    {
      title: 'Team Orders Free',
      icon: Users,
      desc: 'Remove artificial gaps between teammates. Let both drivers race with equal car performance. See who really is the faster driver.',
      badge: 'Free Perez: VER -8%',
    },
    {
      title: 'Remaining Season',
      icon: Radio,
      desc: 'Freeze current real-world standings and simulate only the races left in 2026. Uses live points data from the actual championship.',
      badge: 'Live prediction mode',
    },
  ]

  return (
    <section
      id="whatif"
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: '#000', padding: '100px 0' }}
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
        <p className="mb-4" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '17px', maxWidth: '600px' }}>
          Six scenario types. Rewrite any season from 2018 to 2026. Type in plain English or pick from the visual builder.
        </p>
        <p className="mb-16" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
          NLP powered by Gemma 3 · "What if Hamilton had the Red Bull in 2023?" → instant structured scenario
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

// ─── Prediction Game ──────────────────────────────────────────────────────────

function PredictionGame() {
  const { ref, fadeStyle } = useFadeIn()

  const scoreRules = [
    { pts: '25 / 18 / 15 / 12 / 10', label: 'EXACT POSITION', desc: 'Predict a driver in the exact finishing position (P1–P5). Same points as real F1 scoring.' },
    { pts: '+5', label: 'RIGHT DRIVER, WRONG SLOT', desc: 'Driver is in your top 5 but not in the exact position you predicted. Partial credit for smart picks.' },
    { pts: '+20', label: 'ALL 5 CORRECT (ANY ORDER)', desc: 'You got all five drivers right, just shuffled. Bonus reward for nailing the top-5 field.' },
    { pts: '+50', label: 'PERFECT PREDICTION', desc: 'All five drivers in the exact finishing order. Near-impossible. Maximum flex.' },
  ]

  return (
    <section
      id="game"
      ref={ref as React.RefObject<HTMLElement>}
      style={{ ...fadeStyle, background: '#0a0a0a', padding: '100px 0' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Gamepad2 size={20} color={RED} />
          <p className="font-semibold uppercase tracking-widest" style={{ color: RED, fontSize: '12px' }}>
            Prediction Game
          </p>
        </div>
        <h2
          className="font-black uppercase mb-3"
          style={{ fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.04em', color: '#fff' }}
        >
          Race Day Challenge
        </h2>
        <p className="mb-6" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '17px', maxWidth: '600px' }}>
          Predict the top 5 finishers before every Grand Prix. Compete with friends. Real points, real bragging rights.
        </p>
        <p className="mb-16" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
          Drag & drop 5 drivers from the 2026 grid · Lock in before lights out · Auto-scored against real results
        </p>

        {/* Scoring system */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2px' }}>
          {scoreRules.map((rule) => (
            <div
              key={rule.label}
              style={{
                background: '#111',
                padding: '28px 24px',
                borderTop: `3px solid ${RED}`,
                transition: 'transform 0.3s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
            >
              <div
                className="font-black"
                style={{ fontSize: '28px', color: RED, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '8px' }}
              >
                {rule.pts}
              </div>
              <div
                className="font-bold uppercase"
                style={{ fontSize: '12px', color: '#fff', letterSpacing: '0.06em', marginBottom: '10px' }}
              >
                {rule.label}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.55' }}>
                {rule.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Example leaderboard teaser */}
        <div style={{ marginTop: '40px', background: '#111', border: `1px solid rgba(255,255,255,0.08)`, padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div className="font-semibold uppercase" style={{ fontSize: '11px', color: RED, letterSpacing: '0.1em' }}>
                SAMPLE LEADERBOARD
              </div>
              <div className="font-bold" style={{ fontSize: '16px', color: '#fff', marginTop: '4px' }}>
                China GP 2026 · Round 5
              </div>
            </div>
            <Trophy size={24} color={RED} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', gap: '0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { name: 'kushagra', pts: 100, pos: 1 },
              { name: 'yug', pts: 56, pos: 2 },
              { name: 'dharmik', pts: 43, pos: 3 },
              { name: 'jaypal', pts: 18, pos: 4 },
            ].map((p) => (
              <Fragment key={p.name}>
                <div style={{ padding: '10px 0', fontWeight: 800, color: p.pos === 1 ? RED : 'rgba(255,255,255,0.3)', fontSize: '16px' }}>
                  {p.pos}
                </div>
                <div style={{ padding: '10px 0', fontWeight: 600, color: '#fff', fontSize: '14px', textTransform: 'capitalize' }}>
                  {p.name}
                </div>
                <div style={{ padding: '10px 0', fontWeight: 700, color: p.pos === 1 ? RED : '#fff', fontSize: '14px', textAlign: 'right' }}>
                  {p.pts} pts
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-12">
          <ClipButton to="/game" variant="red" size="lg">
            Play Prediction Game →
          </ClipButton>
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
      desc: 'FastF1 telemetry — every sector time, tyre compound, speed trap, and position change from 2018 to 2026.',
      icon: Zap,
    },
    {
      stat: '1,984',
      label: 'Race Results',
      desc: 'Jolpica/Ergast API — grid positions, finish positions, DNF causes, qualifying times, sprint results. Full history back to 2015.',
      icon: Database,
    },
    {
      stat: '9 × 42',
      label: 'Driver Ratings',
      desc: 'Nine performance metrics for each of 42 drivers. Pace, consistency, wet skill, tyre management, overtaking, qualifying, speed, pit efficiency, teammate index.',
      icon: Star,
    },
    {
      stat: 'Weekly',
      label: 'Live Refresh',
      desc: 'Celery beat auto-updates standings, race results, and driver ratings after every race weekend. Weather forecasts refresh every Thursday.',
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
          Updated after every race weekend · Real standings from Jolpica API
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
    { target: 50000, label: 'Max Iterations' },
    { target: 9, label: 'Seasons of Data' },
    { target: 6, label: 'What-If Types' },
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
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '6px' }}>
            Built by Yug Gandhi & Ansh Agarwal
          </p>
        </div>

        <div style={{ display: 'flex', gap: '32px' }}>
          <div>
            <div className="font-bold uppercase" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Platform
            </div>
            {[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Simulate', to: '/simulate' },
              { label: 'What-If', to: '/what-if' },
              { label: 'Game', to: '/game' },
            ].map((l) => (
              <Link
                key={l.label}
                to={l.to}
                style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none', marginBottom: '6px' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div>
            <div className="font-bold uppercase" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Stack
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: '1.8' }}>
              FastAPI · React 19 · PostgreSQL<br />
              Redis · Celery · NumPy<br />
              FastF1 · Jolpica API
            </p>
          </div>
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
      <SimulationShowcase />
      <WhatIf />
      <PredictionGame />
      <DataSources />
      <Live2026 />
      <StatsBar />
      <Footer />
    </div>
  )
}
