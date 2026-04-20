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

// ─── Static data ─────────────────────────────────────────────────────────────
const DRIVERS = [
  { id:'NOR', name:'Lando Norris',     team:'McLaren',      abbr:'NOR', wdc:0.342, pts:402, podium:0.68, dnf:0.04 },
  { id:'VER', name:'Max Verstappen',   team:'Red Bull',     abbr:'VER', wdc:0.287, pts:388, podium:0.61, dnf:0.06 },
  { id:'PIA', name:'Oscar Piastri',    team:'McLaren',      abbr:'PIA', wdc:0.181, pts:354, podium:0.55, dnf:0.05 },
  { id:'LEC', name:'Charles Leclerc', team:'Ferrari',      abbr:'LEC', wdc:0.094, pts:312, podium:0.44, dnf:0.08 },
  { id:'RUS', name:'George Russell',  team:'Mercedes',     abbr:'RUS', wdc:0.052, pts:289, podium:0.38, dnf:0.07 },
  { id:'HAM', name:'Lewis Hamilton',  team:'Ferrari',      abbr:'HAM', wdc:0.028, pts:241, podium:0.31, dnf:0.09 },
  { id:'ANT', name:'Kimi Antonelli',  team:'Mercedes',     abbr:'ANT', wdc:0.010, pts:198, podium:0.22, dnf:0.12 },
  { id:'SAI', name:'Carlos Sainz',    team:'Williams',     abbr:'SAI', wdc:0.004, pts:124, podium:0.11, dnf:0.09 },
  { id:'ALO', name:'Fernando Alonso', team:'Aston Martin', abbr:'ALO', wdc:0.001, pts:88,  podium:0.06, dnf:0.11 },
  { id:'GAS', name:'Pierre Gasly',    team:'Alpine',       abbr:'GAS', wdc:0.001, pts:62,  podium:0.03, dnf:0.13 },
]

const TEAM_COLORS: Record<string, string> = {
  'McLaren':      '#FF6B1A',
  'Red Bull':     '#1E5BD8',
  'Ferrari':      '#D31E29',
  'Mercedes':     '#00B8A9',
  'Williams':     '#3B9BE5',
  'Aston Martin': '#2E7D5C',
  'Alpine':       '#E879A8',
}

const INITIAL_PICKS = ['NOR', 'VER', 'PIA', 'LEC', 'HAM']

const LEADERBOARD = [
  { rank:1, handle:'apex_overcut',  pts:2847, streak:7, delta:'+32', you:false },
  { rank:2, handle:'trail_braker',  pts:2791, streak:4, delta:'+18', you:false },
  { rank:3, handle:'you',           pts:2684, streak:5, delta:'+41', you:true  },
  { rank:4, handle:'monza_chicane', pts:2633, streak:2, delta:'-7',  you:false },
  { rank:5, handle:'slow_in_fast',  pts:2551, streak:3, delta:'+12', you:false },
  { rank:6, handle:'tire_warmer',   pts:2490, streak:1, delta:'-15', you:false },
]

const SCORE_HISTORY = [
  { gp:'BHR', pts:42 }, { gp:'AUS', pts:61 }, { gp:'JPN', pts:28 },
  { gp:'MON', pts:74 }, { gp:'ESP', pts:49 }, { gp:'CAN', pts:55 },
  { gp:'AUT', pts:81 }, { gp:'GBR', pts:67 },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function Game() {
  const isDark = useIsDark()

  const T = isDark ? {
    bg:'#0b0c0e', panel:'#13151a', sunk:'#0a0b0d',
    rule:'rgba(255,255,255,0.06)', ruleStrong:'rgba(255,255,255,0.12)',
    text:'#e7e5e0', dim:'rgba(231,229,224,0.55)', faint:'rgba(231,229,224,0.32)',
    amber:'#F5A623', amberDim:'rgba(245,166,35,0.14)',
    ok:'#4ADE80', hot:'#EF4444',
  } : {
    bg:'#f4f2ec', panel:'#ffffff', sunk:'#eceae3',
    rule:'rgba(15,15,15,0.08)', ruleStrong:'rgba(15,15,15,0.16)',
    text:'#0f1012', dim:'rgba(15,15,15,0.55)', faint:'rgba(15,15,15,0.32)',
    amber:'#B37610', amberDim:'rgba(179,118,16,0.12)',
    ok:'#0E8A4A', hot:'#C22A22',
  }

  const [picks, setPicks] = useState<string[]>(INITIAL_PICKS)
  const [locked, setLocked] = useState(false)

  const pool   = DRIVERS.filter(d => !picks.includes(d.id))
  const picked = picks.map(id => DRIVERS.find(d => d.id === id)!)

  function addToPool(id: string) {
    if (locked) return
    setPicks(p => p.filter(x => x !== id))
  }
  function pickDriver(id: string) {
    if (locked || picks.length >= 5) return
    setPicks(p => [...p, id])
  }

  function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
      <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.faint, fontWeight: 600, ...style }}>
        {children}
      </div>
    )
  }

  const maxScore = Math.max(...SCORE_HISTORY.map(r => r.pts))

  return (
    <div style={{
      width: '100%', height: 'calc(100vh - 44px)',
      background: T.bg, color: T.text,
      fontFamily: 'Inter, sans-serif', fontSize: 12,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── COUNTDOWN BANNER ── */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${T.rule}`,
        display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 24,
        alignItems: 'center', flexShrink: 0, background: T.panel,
      }}>
        <div>
          <Label style={{ color: T.faint }}>round 13 · hungarian gp · predict pre-race</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 5 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Hungaroring</div>
            <div className="pw-mono" style={{ fontSize: 10, color: T.dim, letterSpacing: '0.07em' }}>
              HUN · 4.381 KM · 70 LAPS · 32°C DRY
            </div>
          </div>
        </div>
        {[
          ['PICKS LOCK', '02:14:07', T.amber],
          ['YOUR STREAK', '5 GP', T.text],
          ['RANK · GLOBAL', '#3 of 12,482', T.text],
        ].map(([k, v, c]) => (
          <div key={k as string} style={{ textAlign:'right' }}>
            <Label style={{ color: T.faint }}>{k}</Label>
            <div className="pw-mono" style={{ fontSize: 16, fontWeight: 700, color: c as string, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 300px', flex:1, minHeight:0 }}>

        {/* LEFT — Driver pool */}
        <div style={{ borderRight:`1px solid ${T.rule}`, padding:'12px 16px', display:'flex', flexDirection:'column', gap:8, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <Label style={{ color: T.faint }}>driver pool · click to add to picks</Label>
            <span className="pw-mono" style={{ fontSize:9, color:T.dim }}>{pool.length} AVAILABLE</span>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:2, overflowY:'auto' }}>
            {pool.map(d => {
              const col = TEAM_COLORS[d.team] || T.amber
              return (
                <div
                  key={d.id}
                  onClick={() => pickDriver(d.id)}
                  style={{
                    display:'grid', gridTemplateColumns:'7px 26px 1fr 40px 56px', gap:9,
                    padding:'7px 9px', alignItems:'center',
                    background:T.sunk, border:`1px solid ${T.rule}`,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    transition:'background 100ms',
                  }}
                  onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.07)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.sunk }}
                >
                  <div style={{ width:3, height:12, background:col }} />
                  <span className="pw-mono" style={{ fontSize:10, fontWeight:700, color:T.text, letterSpacing:'0.04em' }}>{d.abbr}</span>
                  <span style={{ fontSize:10, color:T.text }}>{d.name}</span>
                  <span className="pw-mono" style={{ fontSize:9, color:T.dim, textAlign:'right' }}>
                    {(d.wdc*100).toFixed(1)}%
                  </span>
                  <span style={{ fontSize:9, color:T.faint, letterSpacing:'0.07em', textAlign:'right' }}>
                    {d.team.toUpperCase().slice(0,6)}
                  </span>
                </div>
              )
            })}
            {/* Empty slot fillers */}
            {Array.from({ length: Math.max(0, 10 - pool.length) }).map((_, i) => (
              <div key={'f'+i} style={{
                display:'grid', gridTemplateColumns:'7px 26px 1fr 40px 56px', gap:9,
                padding:'7px 9px', alignItems:'center',
                background:T.sunk, border:`1px solid ${T.rule}`, opacity:0.25,
              }}>
                <div style={{ width:3, height:12, background:T.rule }} />
                <span className="pw-mono" style={{ fontSize:10, color:T.faint }}>—</span>
                <span style={{ fontSize:10, color:T.faint }}>driver {pool.length+i+1}</span>
                <span className="pw-mono" style={{ fontSize:9, color:T.faint }}>—</span>
                <span style={{ fontSize:9, color:T.faint }}>—</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — Your picks */}
        <div style={{ borderRight:`1px solid ${T.rule}`, padding:'12px 18px', display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <Label style={{ color: T.faint }}>your podium + top 5 · hungary</Label>
            <span className="pw-mono" style={{ fontSize:9, color:locked ? T.ok : T.amber }}>
              {locked ? '● LOCKED' : '● DRAFT'}
            </span>
          </div>

          {/* Pick slots */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const d = picked[i]
              const col = d ? TEAM_COLORS[d.team] || T.amber : T.rule
              const isPodium = i < 3
              const label = i === 0 ? 'P1 · WIN' : i === 1 ? 'P2' : i === 2 ? 'P3 · PODIUM' : `P${i+1}`
              const gamePts = [25, 18, 15, 12, 10][i]
              return (
                <div
                  key={i}
                  onClick={() => d && addToPool(d.id)}
                  style={{
                    display:'grid', gridTemplateColumns:'32px 9px 42px 1fr 64px 52px', gap:9,
                    padding:'10px 11px', alignItems:'center',
                    background: d ? (isPodium ? T.amberDim : T.sunk) : T.sunk,
                    border:`1px solid ${d && isPodium ? T.amber : T.ruleStrong}`,
                    cursor: d && !locked ? 'pointer' : 'default',
                    opacity: d ? 1 : 0.4,
                  }}
                >
                  <span className="pw-mono" style={{ fontSize:13, fontWeight:700, color: d && isPodium ? T.amber : T.dim, letterSpacing:'-0.02em' }}>
                    {String(i+1).padStart(2,'0')}
                  </span>
                  <div style={{ width:4, height:18, background:col }} />
                  <span className="pw-mono" style={{ fontSize:12, fontWeight:700, color:T.text }}>{d?.abbr ?? '—'}</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:T.text }}>{d?.name ?? 'Empty slot'}</div>
                    <div className="pw-mono" style={{ fontSize:8, color:T.faint, letterSpacing:'0.07em', marginTop:1 }}>
                      {d ? `${d.team.toUpperCase()} · ${label}` : 'click driver to add'}
                    </div>
                  </div>
                  {d && (
                    <>
                      <div style={{ textAlign:'right' }}>
                        <div className="pw-mono" style={{ fontSize:9, color:T.dim }}>IF CORRECT</div>
                        <div className="pw-mono" style={{ fontSize:13, fontWeight:700, color:isPodium ? T.amber : T.text }}>+{gamePts} pts</div>
                      </div>
                      <div className="pw-mono" style={{ fontSize:9, color:T.dim, textAlign:'right' }}>
                        {(d.wdc*100).toFixed(1)}%<br/>wdc
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bonus picks */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5 }}>
            {[
              ['FASTEST LAP', 'NOR', '+5'],
              ['POLE POSITION', 'NOR', '+3'],
              ['FIRST DNF', 'HAM', '+4'],
            ].map(([k, v, p]) => (
              <div key={k} style={{ padding:'8px 10px', background:T.sunk, border:`1px dashed ${T.ruleStrong}` }}>
                <div style={{ fontSize:8, letterSpacing:'0.12em', color:T.faint, textTransform:'uppercase' }}>{k}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:3 }}>
                  <span className="pw-mono" style={{ fontSize:12, color:T.text, fontWeight:700 }}>{v}</span>
                  <span className="pw-mono" style={{ fontSize:10, color:T.amber }}>{p}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:7, marginTop:2 }}>
            <button
              onClick={() => { if (picks.length === 5) setLocked(l => !l) }}
              disabled={picks.length < 5}
              style={{
                flex:1, background: locked ? T.ok : picks.length === 5 ? T.amber : T.sunk,
                border:'none', color: locked ? '#0b0c0e' : picks.length === 5 ? '#0b0c0e' : T.dim,
                padding:'11px 16px', fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase',
                fontWeight:700, fontFamily:'inherit', cursor: picks.length === 5 ? 'pointer' : 'not-allowed',
                transition:'all 150ms',
              }}
            >
              {locked ? '✓ Picks Locked' : picks.length < 5 ? `Select ${5 - picks.length} more` : 'Lock Picks'}
            </button>
            <button
              onClick={() => { setPicks(INITIAL_PICKS); setLocked(false) }}
              style={{
                background:'transparent', border:`1px solid ${T.ruleStrong}`,
                color:T.text, padding:'11px 16px', fontSize:10, letterSpacing:'0.14em',
                textTransform:'uppercase', fontWeight:500, fontFamily:'inherit', cursor:'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* RIGHT — Leaderboard + history */}
        <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:14, overflow:'hidden' }}>

          {/* Leaderboard */}
          <div>
            <Label style={{ color: T.faint, marginBottom:8 }}>leaderboard · season</Label>
            <div>
              {LEADERBOARD.map(p => (
                <div key={p.handle} style={{
                  display:'grid', gridTemplateColumns:'20px 1fr 48px 32px', gap:7,
                  padding:'7px 7px', alignItems:'center',
                  background: p.you ? T.amberDim : 'transparent',
                  borderBottom:`1px solid ${T.rule}`,
                  borderLeft: p.you ? `2px solid ${T.amber}` : '2px solid transparent',
                }}>
                  <span className="pw-mono" style={{ fontSize:10, fontWeight:700, color: p.you ? T.amber : T.dim }}>
                    {String(p.rank).padStart(2,'0')}
                  </span>
                  <div>
                    <div style={{ fontSize:10, fontWeight: p.you ? 700 : 500, color:T.text }}>@{p.handle}</div>
                    <div className="pw-mono" style={{ fontSize:8, color:T.faint, marginTop:1 }}>streak {p.streak}</div>
                  </div>
                  <span className="pw-mono" style={{ fontSize:10, color:T.text, textAlign:'right', fontWeight:600 }}>
                    {p.pts.toLocaleString()}
                  </span>
                  <span className="pw-mono" style={{ fontSize:9, color: p.delta.startsWith('+') ? T.ok : T.hot, textAlign:'right' }}>
                    {p.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Score history bars */}
          <div>
            <Label style={{ color: T.faint, marginBottom:8 }}>your last 8 rounds</Label>
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:50, borderBottom:`1px solid ${T.rule}`, paddingBottom:3 }}>
              {SCORE_HISTORY.map((r, i) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, height:'100%', justifyContent:'flex-end' }}>
                  <div style={{
                    width:'100%',
                    height:`${(r.pts / maxScore) * 100}%`,
                    background: i === SCORE_HISTORY.length - 1 ? T.amber : T.ruleStrong,
                    transition:'height 600ms ease',
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:3, marginTop:3 }}>
              {SCORE_HISTORY.map((r, i) => (
                <div key={r.gp} className="pw-mono" style={{
                  flex:1, fontSize:7, textAlign:'center', letterSpacing:'0.06em',
                  color: i === SCORE_HISTORY.length - 1 ? T.amber : T.faint,
                }}>
                  {r.gp}
                </div>
              ))}
            </div>
          </div>

          {/* Next milestone */}
          <div style={{ padding:'9px 11px', border:`1px dashed ${T.amber}`, background:T.amberDim }}>
            <div style={{ fontSize:8, letterSpacing:'0.14em', color:T.amber, textTransform:'uppercase', fontWeight:700 }}>
              NEXT MILESTONE
            </div>
            <div style={{ fontSize:11, color:T.text, marginTop:3, lineHeight:1.4 }}>
              Pick the podium correctly <span className="pw-mono" style={{ color:T.amber }}>3×</span> in a row —
              unlock <span style={{ color:T.amber }}>Gold Visor</span> badge.
            </div>
            <div style={{ marginTop:7, height:2, background:T.rule }}>
              <div style={{ width:'66%', height:'100%', background:T.amber }} />
            </div>
            <div className="pw-mono" style={{ fontSize:8, color:T.faint, marginTop:3 }}>2 OF 3 ACHIEVED</div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM STATUS ── */}
      <div style={{
        height:26, borderTop:`1px solid ${T.rule}`,
        display:'flex', alignItems:'center', flexShrink:0,
        fontSize:9, color:T.faint, fontFamily:'JetBrains Mono, monospace',
      }}>
        <div style={{ padding:'0 12px', borderRight:`1px solid ${T.rule}`, color:locked ? T.ok : T.amber }}>
          {locked ? '● PICKS LOCKED' : '● PICKS OPEN'}
        </div>
        <div style={{ padding:'0 12px', borderRight:`1px solid ${T.rule}` }}>12,482 players · 8,847 locked</div>
        <div style={{ padding:'0 12px', borderRight:`1px solid ${T.rule}` }}>round 13 of 24</div>
        <div style={{ flex:1 }} />
        <div style={{ padding:'0 12px', borderLeft:`1px solid ${T.rule}` }}>your best round · monaco · 74 pts</div>
        <div style={{ padding:'0 12px', borderLeft:`1px solid ${T.rule}` }}>@you</div>
      </div>
    </div>
  )
}
