import { useEffect, useState } from 'react'

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

const SCENARIOS = [
  {
    id: 'crash',
    title: 'Championship Crash',
    desc: 'What if the leader DNFs in the next 3 races?',
    example: 'Verstappen → 18% WDC',
    icon: '💥',
    delta: '−16%',
    deltaColor: '#EF4444',
  },
  {
    id: 'form',
    title: 'Form Reversal',
    desc: 'What if a mid-field team gets 15% faster?',
    example: 'Alpine top-5 every race',
    icon: '📈',
    delta: '+23%',
    deltaColor: '#4ADE80',
  },
  {
    id: 'rain',
    title: 'Monsoon Season',
    desc: 'What if the next 5 races are all wet?',
    example: 'Hamilton probability doubles',
    icon: '🌧️',
    delta: '+31%',
    deltaColor: '#4ADE80',
  },
  {
    id: 'penalty',
    title: 'Grid Penalty',
    desc: 'What if the leader takes a 10-place grid penalty?',
    example: 'Title race reopens',
    icon: '🚦',
    delta: '−8%',
    deltaColor: '#EF4444',
  },
  {
    id: 'teammate',
    title: 'Teammate Duel',
    desc: 'What if both McLarens race at 100%?',
    example: 'Piastri closes the gap',
    icon: '⚔️',
    delta: '+12%',
    deltaColor: '#4ADE80',
  },
  {
    id: 'reliability',
    title: 'Reliability Crisis',
    desc: 'What if Red Bull suffers 3 DNFs this season?',
    example: 'Championship flips',
    icon: '🔧',
    delta: '−22%',
    deltaColor: '#EF4444',
  },
]

export default function WhatIf() {
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
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* Page header */}
      <div style={{ padding: '32px 40px 24px', borderBottom: `1px solid ${T.rule}` }}>
        <div className="pw-mono" style={{ fontSize: 9, color: T.amber, letterSpacing: '0.18em', marginBottom: 10 }}>
          SCENARIO ENGINE · COMING SOON
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: T.text, margin: 0 }}>
              WHAT-IF
            </h1>
            <p style={{ fontSize: 12, color: T.dim, marginTop: 8, maxWidth: 460 }}>
              Explore counterfactual scenarios — rewrite the season with a single parameter change.
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ width: 200, paddingBottom: 4 }}>
            <div className="pw-mono" style={{ fontSize: 9, color: T.dim, letterSpacing: '0.1em', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>BUILD PROGRESS</span>
              <span style={{ color: T.amber }}>70%</span>
            </div>
            <div style={{ height: 3, background: T.rule }}>
              <div style={{ height: '100%', background: T.amber, width: '70%' }} />
            </div>
            <div className="pw-mono" style={{ fontSize: 8, color: T.faint, marginTop: 5 }}>
              NLP parser · compare endpoint · 4 scenario types complete
            </div>
          </div>
        </div>
      </div>

      {/* Scenario cards */}
      <div style={{ padding: '28px 40px' }}>
        <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em', marginBottom: 16 }}>
          6 SCENARIO TYPES · SELECT ONE TO SIMULATE
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {SCENARIOS.map(sc => (
            <div
              key={sc.id}
              style={{
                background: T.panel, border: `1px solid ${T.rule}`,
                padding: '16px', position: 'relative', overflow: 'hidden',
                cursor: 'not-allowed', userSelect: 'none',
              }}
            >
              {/* Background icon */}
              <div style={{ fontSize: 42, position: 'absolute', right: 12, top: 8, opacity: 0.07 }}>
                {sc.icon}
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: 22 }}>{sc.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{sc.title}</div>
                  <div style={{ fontSize: 11, color: T.dim, marginTop: 4, lineHeight: 1.4 }}>{sc.desc}</div>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: '8px 10px', background: T.sunk, border: `1px solid ${T.rule}` }}>
                <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.12em', marginBottom: 3 }}>
                  EXAMPLE RESULT
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: T.dim }}>{sc.example}</span>
                  <span className="pw-mono" style={{ fontSize: 12, fontWeight: 700, color: sc.deltaColor }}>{sc.delta}</span>
                </div>
              </div>

              {/* Locked overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: isDark ? 'rgba(11,12,14,0.45)' : 'rgba(244,242,236,0.45)',
                backdropFilter: 'blur(2px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                padding: '10px',
              }}>
                <div style={{
                  background: T.amberDim, border: `1px solid ${T.amber}`,
                  padding: '3px 8px',
                }}>
                  <span className="pw-mono" style={{ fontSize: 7, fontWeight: 700, color: T.amber, letterSpacing: '0.14em' }}>
                    LOCKED
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscribe row */}
      <div style={{ padding: '0 40px 40px' }}>
        <div style={{ padding: '20px 24px', background: T.panel, border: `1px dashed ${T.amber}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Get early access</div>
              <div className="pw-mono" style={{ fontSize: 9, color: T.dim, marginTop: 3, letterSpacing: '0.08em' }}>
                Be first when the scenario engine ships
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="pw-mono" style={{ fontSize: 9, color: T.amber }}>
              ● BACKEND READY · FRONTEND IN PROGRESS
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
