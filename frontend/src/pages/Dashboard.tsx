import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function useIsDark() {
  const [dark, setDark] = useState(
    document.documentElement.getAttribute('data-theme') !== 'light'
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') !== 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

function FrostedCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(8px)',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
      {/* Frosted overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(11,12,14,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'rgba(245,166,35,0.15)',
          border: '1px solid rgba(245,166,35,0.5)',
          padding: '4px 12px',
        }}>
          <span className="pw-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#F5A623' }}>
            COMING SOON
          </span>
        </div>
      </div>
    </div>
  )
}

function FakeTableRow({ pos, name, pct, isDark }: { pos: number; name: string; pct: number; isDark: boolean }) {
  const text  = isDark ? '#e7e5e0' : '#0f1012'
  const amber = isDark ? '#F5A623' : '#B37610'
  const rule  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const colors = ['#FF6B1A','#1E5BD8','#D31E29','#00B8A9','#3B9BE5']
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 8px 1fr 60px 80px',
      gap: 10, padding: '6px 12px', alignItems: 'center',
      borderBottom: `1px solid ${rule}`, fontSize: 11,
    }}>
      <span className="pw-mono" style={{ fontSize: 12, fontWeight: 700, color: pos === 1 ? amber : 'rgba(231,229,224,0.4)' }}>
        {String(pos).padStart(2,'0')}
      </span>
      <span style={{ width: 8, height: 8, background: colors[pos-1], display: 'inline-block' }} />
      <span style={{ color: text }}>{name}</span>
      <span className="pw-mono" style={{ color: pos === 1 ? amber : text, fontWeight: pos === 1 ? 700 : 400 }}>{pct}%</span>
      <div style={{ height: 3, background: rule }}>
        <div style={{ height: '100%', background: pos === 1 ? amber : colors[pos-1], width: `${(pct/35)*100}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const isDark = useIsDark()

  const T = isDark ? {
    bg: '#0b0c0e', panel: '#13151a', sunk: '#0a0b0d',
    rule: 'rgba(255,255,255,0.06)', ruleStrong: 'rgba(255,255,255,0.12)',
    text: '#e7e5e0', dim: 'rgba(231,229,224,0.55)', faint: 'rgba(231,229,224,0.28)',
    amber: '#F5A623', amberDim: 'rgba(245,166,35,0.14)',
  } : {
    bg: '#f4f2ec', panel: '#ffffff', sunk: '#eceae3',
    rule: 'rgba(15,15,15,0.07)', ruleStrong: 'rgba(15,15,15,0.14)',
    text: '#0f1012', dim: 'rgba(15,15,15,0.55)', faint: 'rgba(15,15,15,0.28)',
    amber: '#B37610', amberDim: 'rgba(179,118,16,0.12)',
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 44px)', background: T.bg, color: T.text,
      fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column',
    }}>

      {/* Page header */}
      <div style={{ padding: '32px 40px 24px', borderBottom: `1px solid ${T.rule}` }}>
        <div className="pw-mono" style={{ fontSize: 9, color: T.amber, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>
          dashboard · championship overview
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: T.text, margin: 0 }}>
              DASHBOARD
            </h1>
            <p style={{ fontSize: 12, color: T.dim, marginTop: 8, maxWidth: 480 }}>
              Championship overview · probability trends · driver analytics
            </p>
          </div>

          {/* Hint arrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <Link to="/simulate" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                background: T.amberDim, border: `1px solid ${T.amber}`,
                fontSize: 10, color: T.amber, fontWeight: 700, letterSpacing: '0.08em',
              }}>
                <span className="pw-mono">← SIMULATE A SEASON FIRST TO UNLOCK</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ padding: '28px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, flex: 1 }}>

        {/* Card 1: Championship table */}
        <FrostedCard style={{ background: T.panel, border: `1px solid ${T.ruleStrong}` }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${T.rule}` }}>
            <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em' }}>
              WDC STANDINGS · LIVE
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Championship Table</div>
          </div>
          <div>
            {[
              { pos: 1, name: 'Lando Norris',   pct: 34.2 },
              { pos: 2, name: 'Max Verstappen',  pct: 28.7 },
              { pos: 3, name: 'Oscar Piastri',   pct: 18.1 },
              { pos: 4, name: 'C. Leclerc',      pct: 9.4 },
              { pos: 5, name: 'G. Russell',      pct: 5.2 },
            ].map(r => <FakeTableRow key={r.pos} {...r} isDark={isDark} />)}
          </div>
        </FrostedCard>

        {/* Card 2: Probability chart */}
        <FrostedCard style={{ background: T.panel, border: `1px solid ${T.ruleStrong}` }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${T.rule}` }}>
            <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em' }}>
              WDC PROBABILITY TREND
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Probability Trend</div>
          </div>
          <div style={{ padding: '12px 14px', height: 180, position: 'relative' }}>
            <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }}>
              {/* Fake chart lines */}
              <polyline points="0,110 30,95 60,80 90,72 120,60 150,55 180,50 210,45 240,42" fill="none" stroke="#FF6B1A" strokeWidth="1.5" />
              <polyline points="0,50 30,60 60,68 90,75 120,82 150,87 180,90 210,92 240,95" fill="none" stroke="#1E5BD8" strokeWidth="1.5" />
              <polyline points="0,120 30,115 60,108 90,100 120,93 150,88 180,84 210,80 240,76" fill="none" stroke="#D31E29" strokeWidth="1.5" />
              {/* x-axis labels */}
              {['R1','R4','R7','R10','R12'].map((l, i) => (
                <text key={l} x={i * 60} y="135" fill="rgba(231,229,224,0.3)" fontSize="8" fontFamily="JetBrains Mono">{l}</text>
              ))}
            </svg>
          </div>
        </FrostedCard>

        {/* Card 3: Driver radar */}
        <FrostedCard style={{ background: T.panel, border: `1px solid ${T.ruleStrong}` }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${T.rule}` }}>
            <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em' }}>
              DRIVER PERFORMANCE RADAR
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Driver Analytics</div>
          </div>
          <div style={{ padding: '16px', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 160 140" style={{ width: 160, height: 140 }}>
              {/* Fake radar */}
              {[0.9, 0.6, 0.3].map((r, ri) => (
                <polygon key={ri}
                  points={Array.from({ length: 6 }, (_, i) => {
                    const a = (i * Math.PI * 2) / 6 - Math.PI / 2
                    return `${80 + r * 55 * Math.cos(a)},${70 + r * 55 * Math.sin(a)}`
                  }).join(' ')}
                  fill="none" stroke={`rgba(245,166,35,${0.15 + ri * 0.05})`} strokeWidth="1"
                />
              ))}
              <polygon
                points={[0.9,0.85,0.75,0.95,0.7,0.88].map((v, i) => {
                  const a = (i * Math.PI * 2) / 6 - Math.PI / 2
                  return `${80 + v * 55 * Math.cos(a)},${70 + v * 55 * Math.sin(a)}`
                }).join(' ')}
                fill="rgba(255,107,26,0.2)" stroke="#FF6B1A" strokeWidth="1.5"
              />
            </svg>
          </div>
        </FrostedCard>
      </div>

      {/* Bottom info */}
      <div style={{ padding: '0 40px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="pw-mono" style={{ fontSize: 9, color: T.faint, letterSpacing: '0.12em' }}>
          Run a simulation on the Simulate page to populate live championship data →
        </div>
        <Link to="/simulate" style={{ textDecoration: 'none' }}>
          <span className="pw-mono" style={{ fontSize: 9, color: T.amber, letterSpacing: '0.1em' }}>
            GO TO SIMULATE ↗
          </span>
        </Link>
      </div>
    </div>
  )
}
