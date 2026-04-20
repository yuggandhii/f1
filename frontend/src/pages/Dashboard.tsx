import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSeason } from '../contexts/SeasonContext'
import {
  listSimulations, getDriverProbabilities, getConstructorProbabilities,
  getSeasonCalendar, getSeasonActualResults,
  getTeammateComparison, getDriverRatings, listDrivers,
  type DriverResult, type ConstructorResult, type CalendarRace,
  type ActualRaceResult, type SimulationRun, type DriverRating, type Driver,
} from '../api/client'

// ─── Theme ─────────────────────────────────────────────────────────────────────
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

const TEAM_COLORS: Record<string, string> = {
  'McLaren': '#FF6B1A', 'Red Bull': '#1E5BD8', 'Ferrari': '#D31E29',
  'Mercedes': '#00B8A9', 'Williams': '#3B9BE5', 'Aston Martin': '#2E7D5C',
  'Alpine': '#E879A8', 'RB': '#5C7FE5', 'Haas': '#9CA3AF', 'Sauber': '#4ADE80',
}

function teamColor(t: string | undefined): string {
  if (!t) return '#888'
  return TEAM_COLORS[t] || Object.entries(TEAM_COLORS).find(([k]) => t.toLowerCase().includes(k.toLowerCase()))?.[1] || '#888'
}

// ─── SVG Helpers ───────────────────────────────────────────────────────────────

function RadarChart({ ratings, T, tc }: { ratings: DriverRating | null; T: any; tc?: string }) {
  const axes = [
    { key: 'base_pace', label: 'PACE' },
    { key: 'consistency', label: 'CONSISTENCY' },
    { key: 'wet_skill', label: 'WET' },
    { key: 'tyre_management', label: 'TYRE' },
    { key: 'overtake_skill', label: 'OVERTAKE' },
    { key: 'qualifying_pace', label: 'QUALI' },
  ]
  const cx = 150, cy = 140, maxR = 105
  const getPoint = (i: number, r: number) => {
    const a = (i * Math.PI * 2) / axes.length - Math.PI / 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }
  const ringPoly = (r: number) =>
    axes.map((_, i) => getPoint(i, r)).map(p => `${p.x},${p.y}`).join(' ')

  const vals = ratings
    ? axes.map(a => Math.min(1, Math.max(0, (ratings as any)[a.key] || 0)))
    : axes.map(() => 0)
  const dataPoly = vals.map((v, i) => getPoint(i, v * maxR)).map(p => `${p.x},${p.y}`).join(' ')
  const fillColor = tc || 'rgba(245,166,35,0.18)'
  const strokeColor = tc || T.amber

  return (
    <svg viewBox="0 0 300 290" style={{ width: '100%', height: '100%' }}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1.0].map(r => (
        <polygon key={r} points={ringPoly(r * maxR)}
          fill="none" stroke={T.rule} strokeWidth="1" />
      ))}
      {/* Axis lines */}
      {axes.map((_, i) => {
        const p = getPoint(i, maxR)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={T.rule} strokeWidth="0.5" />
      })}
      {/* Data polygon */}
      {ratings && (
        <polygon points={dataPoly}
          fill={fillColor} fillOpacity={0.2} stroke={strokeColor} strokeWidth="2.5" />
      )}
      {/* Data dots + value labels */}
      {ratings && vals.map((v, i) => {
        const p = getPoint(i, v * maxR)
        const labelP = getPoint(i, v * maxR + (v > 0.7 ? -14 : 14))
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={strokeColor} />
            <circle cx={p.x} cy={p.y} r="6" fill="none" stroke={strokeColor} strokeWidth="1" opacity="0.4" />
            <text x={labelP.x} y={labelP.y} textAnchor="middle" dominantBaseline="middle"
              fill={T.text} fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="700"
            >{(v * 100).toFixed(0)}</text>
          </g>
        )
      })}
      {/* Axis labels */}
      {axes.map((a, i) => {
        const p = getPoint(i, maxR + 24)
        return (
          <text key={a.key} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fill={T.dim} fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="600"
          >{a.label}</text>
        )
      })}
    </svg>
  )
}

function ProgressRing({ value, max, T }: { value: number; max: number; T: any }) {
  const r = 28, stroke = 4, circ = 2 * Math.PI * r
  const pct = max > 0 ? value / max : 0
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={r} fill="none" stroke={T.rule} strokeWidth={stroke} />
      <circle cx="34" cy="34" r={r} fill="none" stroke={T.amber} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="butt" transform="rotate(-90 34 34)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x="34" y="34" textAnchor="middle" dominantBaseline="central"
        fill={T.text} fontSize="14" fontWeight="700" fontFamily="JetBrains Mono, monospace"
      >{value}</text>
    </svg>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const isDark = useIsDark()
  const { season } = useSeason()

  const T = isDark ? {
    bg: '#0b0c0e', panel: '#13151a', sunk: '#0a0b0d',
    rule: 'rgba(255,255,255,0.06)', ruleStrong: 'rgba(255,255,255,0.12)',
    text: '#e7e5e0', dim: 'rgba(231,229,224,0.55)', faint: 'rgba(231,229,224,0.32)',
    amber: '#F5A623', amberDim: 'rgba(245,166,35,0.14)',
    ok: '#4ADE80', hot: '#EF4444',
  } : {
    bg: '#f4f2ec', panel: '#ffffff', sunk: '#eceae3',
    rule: 'rgba(15,15,15,0.08)', ruleStrong: 'rgba(15,15,15,0.16)',
    text: '#0f1012', dim: 'rgba(15,15,15,0.55)', faint: 'rgba(15,15,15,0.32)',
    amber: '#B37610', amberDim: 'rgba(179,118,16,0.12)',
    ok: '#0E8A4A', hot: '#C22A22',
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [_latestRunId, setLatestRunId] = useState<string | null>(null)
  const [simRuns, setSimRuns] = useState<SimulationRun[]>([])
  const [driverResults, setDriverResults] = useState<DriverResult[]>([])
  const [constructorResults, setConstructorResults] = useState<ConstructorResult[]>([])
  const [calendar, setCalendar] = useState<CalendarRace[]>([])
  const [actualResults, setActualResults] = useState<ActualRaceResult[]>([])
  const [teammateData, setTeammateData] = useState<any>(null)
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [selectedRadarDriverId, setSelectedRadarDriverId] = useState<string>('')
  const [radarRatings, setRadarRatings] = useState<DriverRating | null>(null)
  const [now, setNow] = useState(() => new Date())

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])


  // ── Data Fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDriverResults([])
    setConstructorResults([])
    setTeammateData(null)

    async function load() {
      // Parallel independent fetches
      const [sims, cal, actuals, drivers] = await Promise.all([
        listSimulations(season, 20).catch(() => [] as SimulationRun[]),
        getSeasonCalendar(season).catch(() => [] as CalendarRace[]),
        getSeasonActualResults(season).catch(() => [] as ActualRaceResult[]),
        listDrivers().catch(() => [] as Driver[]),
      ])
      if (cancelled) return

      setSimRuns(sims)
      setCalendar(cal)
      setActualResults(actuals)
      setAllDrivers(drivers)

      // Get teammate comparison (may 404)
      getTeammateComparison(season).then(d => !cancelled && setTeammateData(d)).catch(() => {})

      // Find latest completed simulation
      const done = sims.filter(s => s.status === 'done')
      if (done.length > 0) {
        const latest = done[0]
        const rid = latest.run_id
        setLatestRunId(rid)

        const [dr, cr] = await Promise.all([
          getDriverProbabilities(rid).catch(() => [] as DriverResult[]),
          getConstructorProbabilities(rid).catch(() => [] as ConstructorResult[]),
        ])
        if (cancelled) return
        setDriverResults(dr)
        setConstructorResults(cr)

        // Load radar for WDC leader
        if (dr.length > 0) {
          const leaderId = dr[0].driver_id
          setSelectedRadarDriverId(leaderId)
          getDriverRatings(leaderId, season).then(r => !cancelled && setRadarRatings(r)).catch(() => {})
        }
      } else {
        setLatestRunId(null)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [season])

  // Radar driver change
  useEffect(() => {
    if (!selectedRadarDriverId) return
    setRadarRatings(null)
    getDriverRatings(selectedRadarDriverId, season).then(setRadarRatings).catch(() => {})
  }, [selectedRadarDriverId, season])

  // Derived
  const hasData = driverResults.length > 0
  const racesComplete = actualResults.length
  const totalRaces = calendar.length || 24
  const wdcLeader = driverResults[0]
  const wccLeader = constructorResults[0]
  const lastRun = simRuns.find(s => s.status === 'done')
  const simCount = simRuns.filter(s => s.status === 'done').length

  const lastRunAgo = useMemo(() => {
    if (!lastRun?.completed_at) return ''
    const diff = Date.now() - new Date(lastRun.completed_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }, [lastRun, now])

  // Selected radar driver info
  const radarDriverInfo = useMemo(() => {
    const dr = driverResults.find(d => d.driver_id === selectedRadarDriverId)
    if (dr) return { name: dr.driver_name || selectedRadarDriverId, team: dr.team_name || '' }
    const driver = allDrivers.find(d => d.id === selectedRadarDriverId)
    return { name: driver?.name || selectedRadarDriverId, team: '' }
  }, [selectedRadarDriverId, driverResults, allDrivers])

  // ── Render ─────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: T.panel, border: `1px solid ${T.ruleStrong}`, overflow: 'hidden',
  }
  const cardHead = (label: string, title: string): React.ReactNode => (
    <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${T.rule}` }}>
      <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color: T.text }}>{title}</div>
    </div>
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 44px)', background: T.bg, color: T.text, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 40px', borderBottom: `1px solid ${T.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div className="pw-mono" style={{ fontSize: 9, color: T.amber, letterSpacing: '0.18em' }}>DASHBOARD · CHAMPIONSHIP ANALYTICS</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '4px 0 0', lineHeight: 1 }}>PITWALL OVERVIEW</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {!hasData && !loading && (
            <Link to="/simulate" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: T.amberDim, border: `1px solid ${T.amber}`, fontSize: 10, color: T.amber, fontWeight: 700, letterSpacing: '0.08em' }}>
                <span className="pw-mono">← SIMULATE A SEASON TO UNLOCK</span>
              </div>
            </Link>
          )}

        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 40px 40px' }}>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
            <div className="pw-mono" style={{ fontSize: 11, color: T.faint, letterSpacing: '0.12em' }}>LOADING TELEMETRY DATA...</div>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── ROW 1: Hero KPI Cards ────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

              {/* KPI 1: WDC Leader */}
              <div style={{ ...cardStyle, padding: '16px 18px' }}>
                <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em', marginBottom: 8 }}>WDC LEADER</div>
                {wdcLeader ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 4, height: 28, background: teamColor(wdcLeader.team_name) }} />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{wdcLeader.driver_name}</div>
                        <div style={{ fontSize: 10, color: T.dim }}>{wdcLeader.team_name}</div>
                      </div>
                    </div>
                    <div className="pw-mono" style={{ fontSize: 28, fontWeight: 700, color: T.amber, lineHeight: 1 }}>
                      {((wdcLeader.wdc_probability) * 100).toFixed(1)}<span style={{ fontSize: 14, color: T.dim }}>%</span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: T.faint }}>No simulation data</div>
                )}
              </div>

              {/* KPI 2: WCC Leader */}
              <div style={{ ...cardStyle, padding: '16px 18px' }}>
                <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em', marginBottom: 8 }}>WCC LEADER</div>
                {wccLeader ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: teamColor(wccLeader.team_name) }} />
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{wccLeader.team_name}</div>
                    </div>
                    <div className="pw-mono" style={{ fontSize: 28, fontWeight: 700, color: T.amber, lineHeight: 1 }}>
                      {Math.round(wccLeader.expected_points)}<span style={{ fontSize: 12, color: T.dim }}> pts</span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: T.faint }}>No simulation data</div>
                )}
              </div>

              {/* KPI 3: Races Complete */}
              <div style={{ ...cardStyle, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <ProgressRing value={racesComplete} max={totalRaces} T={T} />
                <div>
                  <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em', marginBottom: 4 }}>RACES COMPLETE</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{racesComplete} <span style={{ color: T.dim }}>/ {totalRaces}</span></div>
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>Season {season}</div>
                </div>
              </div>

              {/* KPI 4: Monte Carlo Runs */}
              <div style={{ ...cardStyle, padding: '16px 18px' }}>
                <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.16em', marginBottom: 8 }}>MONTE CARLO SESSIONS</div>
                <div className="pw-mono" style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1 }}>
                  {simCount}
                </div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                  {lastRun ? `${(lastRun.n_simulations || 10000).toLocaleString()} iterations each` : 'No sessions yet'}
                </div>
                <div style={{ fontSize: 9, color: T.faint, marginTop: 2 }}>
                  {lastRunAgo ? `Latest: ${lastRunAgo}` : ''}
                </div>
              </div>
            </div>

            {/* ── ROW 2: WDC Table + Bar Chart ─────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* WDC Championship Table */}
              <div style={cardStyle}>
                {cardHead('WDC STANDINGS · SIMULATED', 'Championship Probabilities')}
                <div style={{ padding: '4px 0' }}>
                  {/* Table header row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 6px 1fr 70px 80px', gap: 8, padding: '6px 14px', fontSize: 9, color: T.faint, letterSpacing: '0.1em' }}>
                    <span>#</span><span></span><span>DRIVER</span><span style={{ textAlign: 'right' }}>WDC %</span><span style={{ textAlign: 'right' }}>EXP PTS</span>
                  </div>
                  {driverResults.slice(0, 10).map((d, i) => {
                    const tc = teamColor(d.team_name)
                    return (
                      <div key={d.driver_id} style={{
                        display: 'grid', gridTemplateColumns: '32px 6px 1fr 70px 80px',
                        gap: 8, padding: '7px 14px', alignItems: 'center',
                        borderBottom: `1px solid ${T.rule}`, fontSize: 12,
                        borderLeft: i === 0 ? `3px solid ${T.amber}` : '3px solid transparent',
                      }}>
                        <span className="pw-mono" style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? T.amber : T.faint }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{ width: 6, height: 6, background: tc, display: 'inline-block', borderRadius: 1 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{d.driver_name}</div>
                          <div style={{ fontSize: 9, color: T.dim, marginTop: 1 }}>{d.team_name}</div>
                        </div>
                        <span className="pw-mono" style={{ textAlign: 'right', fontWeight: i === 0 ? 700 : 400, color: i === 0 ? T.amber : T.text, fontSize: 13 }}>
                          {((d.wdc_probability) * 100).toFixed(1)}%
                        </span>
                        <span className="pw-mono" style={{ textAlign: 'right', color: T.dim, fontSize: 12 }}>
                          {Math.round(d.expected_points)}
                        </span>
                      </div>
                    )
                  })}
                  {driverResults.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: T.faint, fontSize: 11 }}>Run a simulation to see standings</div>
                  )}
                </div>
              </div>

              {/* Points Gap Analysis */}
              <div style={cardStyle}>
                {cardHead('POINTS GAP TO LEADER', 'How far behind? · Expected points deficit')}
                <div style={{ padding: '16px 20px' }}>
                  {driverResults.slice(0, 8).map((d, i) => {
                    const tc = teamColor(d.team_name)
                    const leaderPts = driverResults[0]?.expected_points || 0
                    const gap = Math.round(leaderPts - d.expected_points)
                    const maxGap = Math.max(1, leaderPts - (driverResults[7]?.expected_points || 0))
                    const barW = i === 0 ? 100 : Math.max(3, (gap / maxGap) * 100)
                    const isLeader = i === 0
                    return (
                      <div key={d.driver_id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 6, height: 6, background: tc, borderRadius: 1 }} />
                            <span style={{ fontSize: 11, fontWeight: 600 }}>
                              {d.driver_abbreviation || d.driver_name?.slice(0, 3).toUpperCase()}
                            </span>
                            <span style={{ fontSize: 10, color: T.dim }}>{d.team_name}</span>
                          </div>
                          <div className="pw-mono" style={{ fontSize: 11, fontWeight: 700, color: isLeader ? T.ok : T.text }}>
                            {isLeader ? `${Math.round(d.expected_points)} pts` : `−${gap} pts`}
                          </div>
                        </div>
                        <div style={{ height: 10, background: T.sunk, overflow: 'hidden' }}>
                          {isLeader ? (
                            <div style={{ height: '100%', background: `linear-gradient(90deg, ${tc}, ${T.amber})`, width: '100%', opacity: 0.9 }} />
                          ) : (
                            <div style={{ height: '100%', background: tc, width: `${barW}%`, opacity: 0.5, marginLeft: 'auto' }} />
                          )}
                        </div>
                        {!isLeader && gap > 0 && (
                          <div style={{ fontSize: 9, color: T.faint, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                            Needs ~{Math.ceil(gap / 25)} wins to close gap
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {driverResults.length === 0 && (
                    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.faint, fontSize: 11 }}>No data</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── ROW 3: Constructor Chart + Driver Radar ── MATCHED HEIGHT ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, gridAutoRows: '380px' }}>

              {/* Constructor Stacked Bar */}
              <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {cardHead('CONSTRUCTOR CHAMPIONSHIP', 'WCC Projected Points')}
                <div style={{ padding: '12px 20px', flex: 1, overflowY: 'auto' }}>
                  {constructorResults.map((c, i) => {
                    const tc = teamColor(c.team_name)
                    const maxPts = constructorResults[0]?.expected_points || 1
                    const barW = (c.expected_points / maxPts) * 100
                    return (
                      <div key={c.team_name} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: tc }} />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{c.team_name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="pw-mono" style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? T.amber : T.text }}>
                              {Math.round(c.expected_points)} pts
                            </span>
                            <span className="pw-mono" style={{ fontSize: 9, color: T.dim, background: T.amberDim, padding: '1px 4px' }}>
                              {(c.wcc_probability * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div style={{ height: 12, background: T.sunk, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: tc, width: `${barW}%`, opacity: 0.8, transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  {constructorResults.length === 0 && (
                    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.faint, fontSize: 11 }}>No data</div>
                  )}
                </div>
              </div>

              {/* Driver Radar — Full Height */}
              <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
                {cardHead('DRIVER PERFORMANCE RADAR', radarDriverInfo.name || 'Select Driver')}
                <div style={{ padding: '8px 14px 0' }}>
                  <select
                    value={selectedRadarDriverId}
                    onChange={e => setSelectedRadarDriverId(e.target.value)}
                    style={{
                      width: '100%', background: T.sunk, border: `1px solid ${T.ruleStrong}`,
                      color: T.text, padding: '6px 10px', fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace', outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {driverResults.length > 0
                      ? driverResults.map(d => (
                          <option key={d.driver_id} value={d.driver_id}>
                            {d.driver_name} — {d.team_name}
                          </option>
                        ))
                      : allDrivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))
                    }
                  </select>
                </div>
                <div style={{ flex: 1, padding: '0 6px', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RadarChart ratings={radarRatings} T={T} tc={teamColor(radarDriverInfo.team)} />
                </div>
                {/* Rating summary row */}
                {radarRatings && (
                  <div style={{ padding: '6px 14px 8px', borderTop: `1px solid ${T.rule}`, display: 'flex', justifyContent: 'space-around', flexShrink: 0 }}>
                    {[
                      { label: 'OVR', val: (((radarRatings.base_pace || 0) + (radarRatings.consistency || 0) + (radarRatings.wet_skill || 0) + (radarRatings.tyre_management || 0) + (radarRatings.overtake_skill || 0) + (radarRatings.qualifying_pace || 0)) / 6 * 100).toFixed(0) },
                      { label: 'PEAK', val: (Math.max(radarRatings.base_pace || 0, radarRatings.consistency || 0, radarRatings.wet_skill || 0, radarRatings.tyre_management || 0, radarRatings.overtake_skill || 0, radarRatings.qualifying_pace || 0) * 100).toFixed(0) },
                      { label: 'DNF%', val: ((radarRatings.mechanical_dnf_rate || 0) * 100).toFixed(1) },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.12em', marginBottom: 1 }}>{s.label}</div>
                        <div className="pw-mono" style={{ fontSize: 14, fontWeight: 700, color: T.amber }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── ROW 4: Race Calendar + Teammate Comparison ───────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* Race Calendar Strip */}
              <div style={cardStyle}>
                {cardHead('RACE CALENDAR', `Season ${season} · ${totalRaces} Rounds`)}
                <div style={{ padding: '12px 14px', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
                    {calendar.map((race, i) => {
                      const actual = actualResults.find(a => a.round === race.round)
                      const isComplete = !!actual
                      const isNext = !isComplete && (i === 0 || actualResults.find(a => a.round === calendar[i - 1]?.round))
                      return (
                        <div key={race.round} style={{
                          minWidth: 90, padding: '8px 10px',
                          background: isComplete ? T.amberDim : T.sunk,
                          border: `1px solid ${isNext ? T.amber : T.rule}`,
                          opacity: isComplete ? 1 : 0.6,
                        }}>
                          <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.1em' }}>R{race.round}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{race.short || race.name?.slice(0, 10)}</div>
                          <div style={{ fontSize: 9, color: T.dim, marginTop: 2 }}>{race.country}</div>
                          {isComplete && actual?.winner_abbr && (
                            <div className="pw-mono" style={{ fontSize: 9, color: T.amber, marginTop: 4, fontWeight: 700 }}>
                              🏆 {actual.winner_abbr}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {calendar.length === 0 && (
                      <div style={{ padding: 20, color: T.faint, fontSize: 11 }}>No calendar data</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Teammate Comparison Diverging Bar */}
              <div style={cardStyle}>
                {cardHead('TEAMMATE COMPARISON', `Season ${season} · Relative Performance`)}
                <div style={{ padding: '12px 16px' }}>
                  {(() => {
                    // Use API data if available, otherwise show hardcoded 2026 demo data
                    const drivers = teammateData?.drivers?.length
                      ? teammateData.drivers.slice(0, 10)
                      : [
                          { driver: 'Kimi Antonelli', constructor: 'Mercedes', teammate_index: 0.18, base_pace: 0.92 },
                          { driver: 'Max Verstappen', constructor: 'Red Bull', teammate_index: 0.22, base_pace: 0.98 },
                          { driver: 'Charles Leclerc', constructor: 'Ferrari', teammate_index: 0.15, base_pace: 0.94 },
                          { driver: 'Lando Norris', constructor: 'McLaren', teammate_index: 0.12, base_pace: 0.93 },
                          { driver: 'George Russell', constructor: 'Mercedes', teammate_index: 0.08, base_pace: 0.90 },
                          { driver: 'Lewis Hamilton', constructor: 'Ferrari', teammate_index: -0.05, base_pace: 0.88 },
                          { driver: 'Oscar Piastri', constructor: 'McLaren', teammate_index: -0.08, base_pace: 0.89 },
                          { driver: 'Carlos Sainz', constructor: 'Williams', teammate_index: -0.12, base_pace: 0.85 },
                          { driver: 'Yuki Tsunoda', constructor: 'RB', teammate_index: 0.04, base_pace: 0.82 },
                          { driver: 'Liam Lawson', constructor: 'Red Bull', teammate_index: -0.15, base_pace: 0.84 },
                        ]
                    const maxVal = Math.max(0.3, ...drivers.map((x: any) => Math.abs(x.teammate_index || 0)))
                    return drivers.map((d: any) => {
                      const val = d.teammate_index || 0
                      const barPct = (Math.abs(val) / maxVal) * 50
                      const isPositive = val >= 0
                      const driverTeamColor = teamColor(d.constructor)
                      return (
                        <div key={d.driver} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 100, overflow: 'hidden' }}>
                            <div style={{ width: 4, height: 12, background: driverTeamColor, flexShrink: 0 }} />
                            <div style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.driver}
                            </div>
                          </div>
                          <div style={{ flex: 1, height: 14, position: 'relative', display: 'flex' }}>
                            <div style={{ width: '50%', height: '100%', display: 'flex', justifyContent: 'flex-end', background: T.sunk }}>
                              {!isPositive && (
                                <div style={{ height: '100%', width: `${barPct}%`, background: T.hot, opacity: 0.7 }} />
                              )}
                            </div>
                            <div style={{ width: 1, background: T.ruleStrong, flexShrink: 0 }} />
                            <div style={{ width: '50%', height: '100%', background: T.sunk }}>
                              {isPositive && (
                                <div style={{ height: '100%', width: `${barPct}%`, background: T.ok, opacity: 0.7 }} />
                              )}
                            </div>
                          </div>
                          <div className="pw-mono" style={{ width: 40, fontSize: 9, fontWeight: 600, color: isPositive ? T.ok : T.hot, textAlign: 'right' }}>
                            {val > 0 ? '+' : ''}{val.toFixed(2)}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
