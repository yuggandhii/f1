import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

// ─── Design tokens (matches Dashboard / Simulate exactly) ─────────────────────
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

// ─── All 20 F1 2026 drivers ────────────────────────────────────────────────────
const DRIVERS = [
  { id: 'NOR', name: 'Lando Norris',       team: 'McLaren',      number: 4  },
  { id: 'PIA', name: 'Oscar Piastri',      team: 'McLaren',      number: 81 },
  { id: 'VER', name: 'Max Verstappen',     team: 'Red Bull',     number: 1  },
  { id: 'LAW', name: 'Liam Lawson',        team: 'Red Bull',     number: 30 },
  { id: 'LEC', name: 'Charles Leclerc',    team: 'Ferrari',      number: 16 },
  { id: 'HAM', name: 'Lewis Hamilton',     team: 'Ferrari',      number: 44 },
  { id: 'RUS', name: 'George Russell',     team: 'Mercedes',     number: 63 },
  { id: 'ANT', name: 'Kimi Antonelli',     team: 'Mercedes',     number: 12 },
  { id: 'ALO', name: 'Fernando Alonso',    team: 'Aston Martin', number: 14 },
  { id: 'STR', name: 'Lance Stroll',       team: 'Aston Martin', number: 18 },
  { id: 'GAS', name: 'Pierre Gasly',       team: 'Alpine',       number: 10 },
  { id: 'DOO', name: 'Jack Doohan',        team: 'Alpine',       number: 7  },
  { id: 'ALB', name: 'Alexander Albon',    team: 'Williams',     number: 23 },
  { id: 'SAI', name: 'Carlos Sainz',       team: 'Williams',     number: 55 },
  { id: 'HUL', name: 'Nico Hülkenberg',    team: 'Sauber',       number: 27 },
  { id: 'BOR', name: 'Gabriel Bortoleto', team: 'Sauber',       number: 5  },
  { id: 'TSU', name: 'Yuki Tsunoda',       team: 'RB',           number: 22 },
  { id: 'HAD', name: 'Isack Hadjar',       team: 'RB',           number: 6  },
  { id: 'MAG', name: 'Kevin Magnussen',    team: 'Haas',         number: 20 },
  { id: 'OCO', name: 'Esteban Ocon',       team: 'Haas',         number: 31 },
]

const TEAM_COLORS: Record<string, string> = {
  'McLaren':      '#FF8000',
  'Red Bull':     '#3671C6',
  'Ferrari':      '#E8002D',
  'Mercedes':     '#27F4D2',
  'Aston Martin': '#358C75',
  'Alpine':       '#FF87BC',
  'Williams':     '#64C4FF',
  'Sauber':       '#52E252',
  'RB':           '#6692FF',
  'Haas':         '#B6BABD',
}

// ─── Point system ──────────────────────────────────────────────────────────────
const POS_POINTS = [25, 18, 15, 12, 10]
// +5 for each driver in your top-5 but wrong position
// +20 bonus if all 5 drivers correct (any order)
// +50 bonus if all 5 in exact order

// ─── China GP 2026 — Round 5 seeded data ──────────────────────────────────────
// Actual race result: Shanghai International Circuit, March 23 2026
const CHINA_ACTUAL = ['NOR', 'VER', 'PIA', 'LEC', 'RUS']
const CHINA_PICKS_SEED = [
  { name: 'kushagra', picks: ['NOR', 'VER', 'PIA', 'LEC', 'RUS'] },
  { name: 'yug',      picks: ['NOR', 'PIA', 'VER', 'RUS', 'LEC'] },
  { name: 'dharmik',  picks: ['VER', 'NOR', 'LEC', 'RUS', 'PIA'] },
  { name: 'jaypal',   picks: ['HAM', 'VER', 'NOR', 'LEC', 'ANT'] },
]

// ─── Score computation ────────────────────────────────────────────────────────
interface ScoreRow { pick: string; pos: number; actualPos: number | null; exact: boolean; inTop5: boolean; pts: number }
interface ScoreResult { total: number; breakdown: ScoreRow[]; allInTop5: boolean; allExact: boolean; bonusAnyOrder: number; bonusExact: number }

function computeScore(picks: string[], actual: string[]): ScoreResult {
  const breakdown: ScoreRow[] = picks.map((abbr, i) => {
    const actualPos = actual.indexOf(abbr)
    const exact   = actualPos === i
    const inTop5  = actualPos >= 0
    const pts     = exact ? POS_POINTS[i] : inTop5 ? 5 : 0
    return { pick: abbr, pos: i, actualPos: inTop5 ? actualPos : null, exact, inTop5, pts }
  })
  const allInTop5 = picks.every(p => actual.includes(p))
  const allExact  = picks.every((p, i) => actual[i] === p)
  const bonusAnyOrder = allInTop5 && !allExact ? 20 : 0
  const bonusExact    = allExact ? 70 : 0          // +20 + +50 combined
  const base  = breakdown.reduce((s, b) => s + b.pts, 0)
  return { total: base + bonusAnyOrder + bonusExact, breakdown, allInTop5, allExact, bonusAnyOrder, bonusExact }
}

// Pre-compute China GP scores
const CHINA_SCORED = CHINA_PICKS_SEED
  .map(e => ({ ...e, ...computeScore(e.picks, CHINA_ACTUAL) }))
  .sort((a, b) => b.total - a.total)

// ─── Next race shape ───────────────────────────────────────────────────────────
interface NextRace {
  race_name: string
  circuit: string
  locality: string
  country: string
  season: number
  round: number
  date: string
  time: string
  days_until: number | null
}

interface LeaderboardEntry {
  id: string
  player_name: string
  picks: string[]
  score: number | null
  created_at: string
}

// ─── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(targetDateStr: string, targetTimeStr: string) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0 })

  useEffect(() => {
    if (!targetDateStr) return
    const tick = () => {
      try {
        const dt = new Date(`${targetDateStr}T${targetTimeStr.replace('Z', '+00:00')}`)
        const now = Date.now()
        const diff = dt.getTime() - now
        if (diff <= 0) { setParts({ d: 0, h: 0, m: 0, s: 0 }); return }
        const totalSec = Math.floor(diff / 1000)
        setParts({
          d: Math.floor(totalSec / 86400),
          h: Math.floor((totalSec % 86400) / 3600),
          m: Math.floor((totalSec % 3600) / 60),
          s: totalSec % 60,
        })
      } catch {}
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDateStr, targetTimeStr])

  return parts
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Game() {
  const isDark = useIsDark()

  const T = isDark ? {
    bg: '#0b0c0e', panel: '#13151a', sunk: '#0a0b0d',
    rule: 'rgba(255,255,255,0.06)', ruleStrong: 'rgba(255,255,255,0.12)',
    text: '#e7e5e0', dim: 'rgba(231,229,224,0.55)', faint: 'rgba(231,229,224,0.32)',
    amber: '#F5A623', amberDim: 'rgba(245,166,35,0.14)',
    ok: '#4ADE80', hot: '#EF4444', red: '#EE3F2C',
  } : {
    bg: '#f4f2ec', panel: '#ffffff', sunk: '#eceae3',
    rule: 'rgba(15,15,15,0.08)', ruleStrong: 'rgba(15,15,15,0.16)',
    text: '#0f1012', dim: 'rgba(15,15,15,0.55)', faint: 'rgba(15,15,15,0.32)',
    amber: '#B37610', amberDim: 'rgba(179,118,16,0.12)',
    ok: '#0E8A4A', hot: '#C22A22', red: '#C0392B',
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const [nextRace, setNextRace] = useState<NextRace | null>(null)
  const [raceLoading, setRaceLoading] = useState(true)

  // picks = ordered array of driver ids, max 5
  const [picks, setPicks] = useState<string[]>([])
  const [locked, setLocked] = useState(false)

  // Name modal
  const [showNameModal, setShowNameModal] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // Right panel tabs + expand
  const [rightTab, setRightTab] = useState<'current' | 'lastrace'>('current')
  interface ExpandedPick { player_name: string; picks: string[]; actual: string[] | null; race: string }
  const [expandedPick, setExpandedPick] = useState<ExpandedPick | null>(null)

  // Countdown
  const cd = useCountdown(nextRace?.date ?? '', nextRace?.time ?? '00:00:00Z')

  // ── Fetch next race ────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get('/api/v1/game/next-race')
      .then(r => { setNextRace(r.data); setRaceLoading(false) })
      .catch(() => {
        setNextRace({
          race_name: 'Miami Grand Prix',
          circuit: 'Miami International Autodrome',
          locality: 'Miami', country: 'USA',
          season: 2026, round: 6,
          date: '2026-05-04', time: '20:00:00Z',
          days_until: 14,
        })
        setRaceLoading(false)
      })
  }, [])

  // ── Fetch leaderboard when race known ─────────────────────────────────────
  const fetchLeaderboard = useCallback((raceName: string) => {
    axios.get('/api/v1/game/picks', { params: { race_name: raceName } })
      .then(r => setLeaderboard(r.data.picks || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (nextRace?.race_name) fetchLeaderboard(nextRace.race_name)
  }, [nextRace, fetchLeaderboard])

  // ── Pick management ────────────────────────────────────────────────────────
  const pool = DRIVERS.filter(d => !picks.includes(d.id))
  const picked = picks.map(id => DRIVERS.find(d => d.id === id)!)

  function addDriver(id: string) {
    if (locked || picks.length >= 5) return
    setPicks(p => [...p, id])
  }
  function removeDriver(id: string) {
    if (locked) return
    setPicks(p => p.filter(x => x !== id))
  }
  function moveUp(index: number) {
    if (locked || index === 0) return
    setPicks(p => {
      const next = [...p]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }
  function moveDown(index: number) {
    if (locked || index >= picks.length - 1) return
    setPicks(p => {
      const next = [...p]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  // ── Lock flow ──────────────────────────────────────────────────────────────
  function handleLockClick() {
    if (picks.length < 5 || locked) return
    setShowNameModal(true)
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }

  async function handleSubmit() {
    if (!playerName.trim() || !nextRace) return
    setSubmitting(true)
    try {
      await axios.post('/api/v1/game/picks', {
        player_name: playerName.trim(),
        race_name: nextRace.race_name,
        season: nextRace.season,
        round: nextRace.round,
        pick_1: picks[0],
        pick_2: picks[1],
        pick_3: picks[2],
        pick_4: picks[3],
        pick_5: picks[4],
      })
      setLocked(true)
      setShowNameModal(false)
      setSubmitDone(true)
      fetchLeaderboard(nextRace.race_name)
    } catch {
      alert('Failed to save picks. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Inline helpers ─────────────────────────────────────────────────────────
  function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
      <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.faint, fontWeight: 600, ...style }}>
        {children}
      </div>
    )
  }

  function pad(n: number) { return String(n).padStart(2, '0') }

  // ─── Countdown Segment ──────────────────────────────────────────────────────
  function CdSeg({ val, label }: { val: number; label: string }) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="pw-mono" style={{ fontSize: 22, fontWeight: 800, color: T.amber, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {pad(val)}
        </div>
        <div style={{ fontSize: 8, letterSpacing: '0.14em', color: T.faint, marginTop: 2 }}>{label}</div>
      </div>
    )
  }

  // ─── Driver Pool Row ───────────────────────────────────────────────────────
  function PoolRow({ d }: { d: typeof DRIVERS[0] }) {
    const col = TEAM_COLORS[d.team] || T.amber
    const full = picks.length >= 5
    return (
      <div
        onClick={() => addDriver(d.id)}
        style={{
          display: 'grid', gridTemplateColumns: '4px 32px 1fr 60px',
          gap: 8, padding: '7px 10px', alignItems: 'center',
          background: T.sunk, border: `1px solid ${T.rule}`,
          cursor: locked || full ? 'not-allowed' : 'pointer',
          opacity: full ? 0.45 : 1,
          transition: 'background 100ms',
        }}
        onMouseEnter={e => { if (!locked && !full) (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.09)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.sunk }}
      >
        <div style={{ width: 3, height: 14, background: col, flexShrink: 0 }} />
        <span className="pw-mono" style={{ fontSize: 10, fontWeight: 700, color: T.text, letterSpacing: '0.04em' }}>
          {d.id}
        </span>
        <div>
          <div style={{ fontSize: 11, color: T.text, fontWeight: 500 }}>{d.name}</div>
          <div style={{ fontSize: 8, color: T.faint, letterSpacing: '0.06em', marginTop: 1 }}>{d.team.toUpperCase()}</div>
        </div>
        <span style={{ fontSize: 9, color: T.dim, textAlign: 'right', letterSpacing: '0.04em' }}>
          #{d.number}
        </span>
      </div>
    )
  }

  // ─── Pick Slot ────────────────────────────────────────────────────────────
  function PickSlot({ index }: { index: number }) {
    const d = picked[index]
    const col = d ? TEAM_COLORS[d.team] || T.amber : T.rule
    const pts = POS_POINTS[index]
    const isPodium = index < 3
    const posLabel = index === 0 ? 'P1 · WIN' : index === 1 ? 'P2' : index === 2 ? 'P3 · PODIUM' : `P${index + 1}`
    const isFilled = !!d

    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 24px 4px 42px 1fr 60px 28px 28px',
        gap: 7, padding: '9px 10px', alignItems: 'center',
        background: isFilled ? (isPodium ? T.amberDim : T.sunk) : T.sunk,
        border: `1px solid ${isFilled && isPodium ? T.amber : T.ruleStrong}`,
        opacity: isFilled ? 1 : 0.4,
        transition: 'all 150ms',
      }}>
        {/* Position label */}
        <span className="pw-mono" style={{ fontSize: 14, fontWeight: 800, color: isFilled && isPodium ? T.amber : T.dim, letterSpacing: '-0.03em' }}>
          {pad(index + 1)}
        </span>

        {/* Abbreviation */}
        <span className="pw-mono" style={{ fontSize: 11, fontWeight: 700, color: T.text }}>
          {d?.id ?? '—'}
        </span>

        {/* Team colour bar */}
        <div style={{ width: 3, height: 20, background: col }} />

        {/* Name */}
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{d?.name ?? 'Empty slot'}</div>
          <div className="pw-mono" style={{ fontSize: 8, color: T.faint, letterSpacing: '0.06em', marginTop: 1 }}>
            {d ? `${d.team.toUpperCase()} · ${posLabel}` : 'click driver to add'}
          </div>
        </div>

        {/* Points if correct */}
        {isFilled && (
          <div style={{ textAlign: 'right' }}>
            <div className="pw-mono" style={{ fontSize: 8, color: T.faint }}>IF CORRECT</div>
            <div className="pw-mono" style={{ fontSize: 13, fontWeight: 700, color: isPodium ? T.amber : T.text }}>
              +{pts}
            </div>
          </div>
        )}
        {!isFilled && <div />}

        {/* Move Up/Down arrows */}
        <button
          disabled={!isFilled || locked || index === 0}
          onClick={() => moveUp(index)}
          style={{
            background: 'transparent', border: `1px solid ${T.ruleStrong}`,
            color: isFilled && !locked && index > 0 ? T.dim : T.faint,
            width: 22, height: 22, fontSize: 10, cursor: isFilled && !locked && index > 0 ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
          }}
        >▲</button>
        <button
          disabled={!isFilled || locked || index >= picks.length - 1}
          onClick={() => moveDown(index)}
          style={{
            background: 'transparent', border: `1px solid ${T.ruleStrong}`,
            color: isFilled && !locked && index < picks.length - 1 ? T.dim : T.faint,
            width: 22, height: 22, fontSize: 10, cursor: isFilled && !locked && index < picks.length - 1 ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
          }}
        >▼</button>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: 'calc(100vh - 44px)',
      background: T.bg, color: T.text,
      fontFamily: 'Inter, sans-serif', fontSize: 12,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── PICK DETAIL MODAL ── */}
      {expandedPick && (
        <div
          onClick={() => setExpandedPick(null)}
          style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.panel, border: `1px solid ${T.amber}`,
              padding: 24, width: 380, display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.amber, fontWeight: 600, marginBottom: 4 }}>
                  {expandedPick.race}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>
                  {expandedPick.player_name}
                </div>
              </div>
              <button
                onClick={() => setExpandedPick(null)}
                style={{ background: 'transparent', border: `1px solid ${T.ruleStrong}`, color: T.dim, width: 28, height: 28, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
              >✕</button>
            </div>

            {/* Actual result reference (only for scored races) */}
            {expandedPick.actual && (
              <div style={{ background: T.sunk, border: `1px solid ${T.ruleStrong}`, padding: '8px 10px' }}>
                <div style={{ fontSize: 8, letterSpacing: '0.14em', color: T.faint, marginBottom: 5 }}>ACTUAL RESULT</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {expandedPick.actual.map((abbr, i) => {
                    const d = DRIVERS.find(x => x.id === abbr)
                    const col = d ? TEAM_COLORS[d.team] || T.amber : T.rule
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: 3, height: 10, background: col }} />
                        <span className="pw-mono" style={{ fontSize: 8, color: T.faint }}>P{i+1}</span>
                        <span className="pw-mono" style={{ fontSize: 9, fontWeight: 700, color: T.text }}>{abbr}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pick rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {expandedPick.picks.map((abbr, i) => {
                const d = DRIVERS.find(x => x.id === abbr)
                const col = d ? TEAM_COLORS[d.team] || T.amber : T.rule
                const actual = expandedPick.actual
                const actualPos = actual ? actual.indexOf(abbr) : -1
                const exact   = actual ? actualPos === i : false
                const inTop5  = actual ? actualPos >= 0 : false
                const pts     = actual ? (exact ? POS_POINTS[i] : inTop5 ? 5 : 0) : null
                const statusCol = actual ? (exact ? T.ok : inTop5 ? T.amber : T.hot) : T.dim
                const statusLabel = actual
                  ? (exact ? `✓ EXACT` : inTop5 ? `↕ IN TOP-5 (P${actualPos+1})` : '✗ NOT IN TOP-5')
                  : 'PENDING'
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '22px 4px 36px 1fr 60px 42px',
                    gap: 8, padding: '8px 10px', alignItems: 'center',
                    background: T.sunk,
                    border: `1px solid ${actual && exact ? T.ok : actual && !inTop5 && actual !== null ? 'rgba(239,68,68,0.2)' : T.rule}`,
                  }}>
                    <span className="pw-mono" style={{ fontSize: 12, fontWeight: 700, color: T.dim }}>P{i+1}</span>
                    <div style={{ width: 3, height: 16, background: col }} />
                    <span className="pw-mono" style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{abbr}</span>
                    <span style={{ fontSize: 10, color: T.dim }}>{d?.name ?? '—'}</span>
                    <span className="pw-mono" style={{ fontSize: 8, color: statusCol, letterSpacing: '0.04em' }}>{statusLabel}</span>
                    <span className="pw-mono" style={{ fontSize: 12, fontWeight: 700, color: pts !== null && pts > 0 ? T.amber : T.faint, textAlign: 'right' }}>
                      {pts !== null ? (pts > 0 ? `+${pts}` : '0') : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Score summary */}
            {expandedPick.actual ? (() => {
              const res = computeScore(expandedPick.picks, expandedPick.actual)
              return (
                <div style={{ border: `1px solid ${T.ruleStrong}`, padding: '10px 12px' }}>
                  {res.bonusExact > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px solid ${T.rule}` }}>
                      <span style={{ fontSize: 10, color: T.dim }}>All 5 exact order bonus</span>
                      <span className="pw-mono" style={{ fontSize: 10, color: T.ok, fontWeight: 700 }}>+{res.bonusExact}</span>
                    </div>
                  )}
                  {res.bonusAnyOrder > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px solid ${T.rule}` }}>
                      <span style={{ fontSize: 10, color: T.dim }}>All 5 in top-5 bonus</span>
                      <span className="pw-mono" style={{ fontSize: 10, color: T.amber, fontWeight: 700 }}>+{res.bonusAnyOrder}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>TOTAL</span>
                    <span className="pw-mono" style={{ fontSize: 18, fontWeight: 800, color: T.amber }}>{res.total} pts</span>
                  </div>
                </div>
              )
            })() : (
              <div style={{ padding: '8px 12px', background: T.sunk, fontSize: 10, color: T.faint, textAlign: 'center' }}>
                Score will be calculated after the race finishes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NAME MODAL ── */}
      {showNameModal && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: T.panel, border: `1px solid ${T.amber}`,
            padding: 28, width: 320, display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div>
              <Label style={{ color: T.amber, marginBottom: 6 }}>enter your name to lock picks</Label>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Lock Your Prediction</div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
                Once locked, your {nextRace?.race_name} picks are saved to the leaderboard.
              </div>
            </div>

            {/* Preview picks */}
            <div style={{ background: T.sunk, border: `1px solid ${T.ruleStrong}`, padding: '10px 12px' }}>
              {picks.map((id, i) => {
                const d = DRIVERS.find(x => x.id === id)!
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: i < 4 ? `1px solid ${T.rule}` : 'none' }}>
                    <span className="pw-mono" style={{ fontSize: 10, color: T.faint }}>P{i + 1}</span>
                    <span style={{ fontSize: 11, color: T.text, flex: 1, marginLeft: 10 }}>{d?.name}</span>
                    <span className="pw-mono" style={{ fontSize: 10, color: T.amber }}>+{POS_POINTS[i]}</span>
                  </div>
                )
              })}
            </div>

            <input
              ref={nameInputRef}
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Your name / handle..."
              maxLength={80}
              style={{
                background: T.sunk, border: `1px solid ${T.ruleStrong}`,
                color: T.text, padding: '10px 12px', fontSize: 13,
                fontFamily: 'inherit', outline: 'none',
                borderColor: playerName.trim() ? T.amber : T.ruleStrong,
              }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSubmit}
                disabled={!playerName.trim() || submitting}
                style={{
                  flex: 1, background: playerName.trim() ? T.amber : T.sunk,
                  border: 'none', color: '#0b0c0e',
                  padding: '11px 0', fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase', fontWeight: 700, fontFamily: 'inherit',
                  cursor: playerName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {submitting ? 'Saving...' : '🔒 Lock Picks'}
              </button>
              <button
                onClick={() => setShowNameModal(false)}
                style={{
                  background: 'transparent', border: `1px solid ${T.ruleStrong}`,
                  color: T.text, padding: '11px 16px', fontSize: 10,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP BANNER ── */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${T.rule}`,
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 24,
        alignItems: 'center', flexShrink: 0, background: T.panel,
      }}>
        {/* Race info */}
        <div>
          <Label style={{ color: T.faint }}>
            {raceLoading ? 'loading next race...' : `round ${nextRace?.round} · ${nextRace?.race_name?.toUpperCase()} · predict the top 5`}
          </Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 5 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {nextRace?.circuit ?? '—'}
            </div>
            <div className="pw-mono" style={{ fontSize: 10, color: T.dim, letterSpacing: '0.07em' }}>
              {nextRace ? `${nextRace.locality} · ${nextRace.country} · ${nextRace.date}` : ''}
            </div>
          </div>
        </div>

        {/* Countdown — single flex row, never wraps */}
        {nextRace?.date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CdSeg val={cd.d} label="DAYS" />
            <div style={{ color: T.amber, fontSize: 16, fontWeight: 800, opacity: 0.5, marginBottom: 10 }}>:</div>
            <CdSeg val={cd.h} label="HRS" />
            <div style={{ color: T.amber, fontSize: 16, fontWeight: 800, opacity: 0.5, marginBottom: 10 }}>:</div>
            <CdSeg val={cd.m} label="MIN" />
            <div style={{ color: T.amber, fontSize: 16, fontWeight: 800, opacity: 0.5, marginBottom: 10 }}>:</div>
            <CdSeg val={cd.s} label="SEC" />
          </div>
        )}

        {/* Picks status */}
        <div style={{ textAlign: 'right' }}>
          <Label style={{ color: T.faint }}>PICKS STATUS</Label>
          <div className="pw-mono" style={{ fontSize: 13, fontWeight: 700, color: locked ? T.ok : T.amber, marginTop: 2 }}>
            {locked ? '● LOCKED' : picks.length < 5 ? `${picks.length}/5 PICKED` : '● READY TO LOCK'}
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 280px', flex: 1, minHeight: 0 }}>

        {/* LEFT — Driver Pool */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>driver pool · click to add to picks</Label>
            <span className="pw-mono" style={{ fontSize: 9, color: T.dim }}>{pool.length} AVAILABLE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>
            {pool.map(d => <PoolRow key={d.id} d={d} />)}
          </div>
        </div>

        {/* CENTER — Your Picks */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>your top 5 · {nextRace?.locality?.toLowerCase() ?? '—'}</Label>
            <span className="pw-mono" style={{ fontSize: 9, color: locked ? T.ok : T.amber }}>
              {locked ? '● LOCKED' : '● DRAFT'}
            </span>
          </div>

          {/* 5 pick slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} onClick={() => picked[i] && removeDriver(picked[i].id)} style={{ cursor: picked[i] && !locked ? 'pointer' : 'default' }}>
                <PickSlot index={i} />
              </div>
            ))}
          </div>

          {/* Point system legend */}
          <div style={{ background: T.sunk, border: `1px solid ${T.ruleStrong}`, padding: '10px 12px' }}>
            <Label style={{ marginBottom: 6, color: T.amber }}>point system</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
              {[
                ['Exact P1', '+25 pts'],
                ['Exact P2–P3', '+18/15 pts'],
                ['Exact P4–P5', '+12/10 pts'],
                ['In top-5, wrong pos', '+5 each'],
                ['All 5 correct (any order)', '+20 bonus'],
                ['All 5 exact order', '+50 bonus'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${T.rule}`, padding: '2px 0' }}>
                  <span style={{ fontSize: 9, color: T.dim }}>{k}</span>
                  <span className="pw-mono" style={{ fontSize: 9, color: T.amber, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lock / Reset */}
          <div style={{ display: 'flex', gap: 7, marginTop: 'auto' }}>
            <button
              onClick={handleLockClick}
              disabled={picks.length < 5 || locked}
              style={{
                flex: 1, background: locked ? T.ok : picks.length === 5 ? T.amber : T.sunk,
                border: 'none',
                color: locked ? '#0b0c0e' : picks.length === 5 ? '#0b0c0e' : T.dim,
                padding: '11px 16px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: 700, fontFamily: 'inherit',
                cursor: picks.length === 5 && !locked ? 'pointer' : 'not-allowed',
                transition: 'all 150ms',
              }}
            >
              {locked ? '✓ Picks Locked' : picks.length < 5 ? `Select ${5 - picks.length} more` : '🔒 Lock Picks'}
            </button>
            <button
              onClick={() => { setPicks([]); setLocked(false); setSubmitDone(false); setPlayerName('') }}
              style={{
                background: locked ? 'rgba(239,68,68,0.12)' : 'transparent',
                border: `1px solid ${locked ? T.hot : T.ruleStrong}`,
                color: locked ? T.hot : T.text, padding: '11px 16px', fontSize: 10,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: locked ? 700 : 500, fontFamily: 'inherit',
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              {locked ? '↺ New Pick' : 'Reset'}
            </button>
          </div>

          {submitDone && (
            <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.1)', border: `1px solid ${T.ok}`, fontSize: 11, color: T.ok, textAlign: 'center' }}>
              ✓ Picks saved to leaderboard as <strong>{playerName}</strong>
            </div>
          )}
        </div>

        {/* RIGHT — Tabbed Leaderboard */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${T.rule}`, flexShrink: 0 }}>
            {([
              { key: 'current',  label: `UPCOMING · ${nextRace?.locality?.toUpperCase() ?? 'MIAMI'}` },
              { key: 'lastrace', label: 'LAST RACE · CHINA' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                style={{
                  flex: 1, padding: '9px 8px', fontSize: 8, letterSpacing: '0.12em',
                  textTransform: 'uppercase', fontWeight: rightTab === tab.key ? 700 : 500,
                  background: rightTab === tab.key ? T.amberDim : 'transparent',
                  borderBottom: rightTab === tab.key ? `2px solid ${T.amber}` : '2px solid transparent',
                  color: rightTab === tab.key ? T.amber : T.faint,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  borderBottomStyle: 'solid', borderBottomWidth: 2,
                  borderBottomColor: rightTab === tab.key ? T.amber : 'transparent',
                  transition: 'all 150ms',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8 }}>

            {/* ── UPCOMING (Miami) ── */}
            {rightTab === 'current' && (
              <>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.faint, fontWeight: 600, marginBottom: 2 }}>
                  CURRENT PICKS · {nextRace?.race_name ?? '—'}
                </div>
                {leaderboard.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: T.faint, fontSize: 11 }}>
                    No picks yet for this race.<br />
                    <span style={{ color: T.amber }}>Be the first!</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1 }}>
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={entry.id}
                        onClick={() => setExpandedPick({ player_name: entry.player_name, picks: entry.picks, actual: null, race: nextRace?.race_name ?? 'Miami GP' })}
                        style={{
                          padding: '8px 10px', cursor: 'pointer',
                          background: entry.player_name === playerName && submitDone ? T.amberDim : T.sunk,
                          border: `1px solid ${entry.player_name === playerName && submitDone ? T.amber : T.rule}`,
                          borderLeft: `3px solid ${entry.player_name === playerName && submitDone ? T.amber : 'transparent'}`,
                          transition: 'background 100ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.07)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = entry.player_name === playerName && submitDone ? T.amberDim : T.sunk }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="pw-mono" style={{ fontSize: 9, fontWeight: 700, color: T.faint }}>#{idx+1}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{entry.player_name}</span>
                          </div>
                          <span className="pw-mono" style={{ fontSize: 9, color: T.faint }}>pending · click to view</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {entry.picks.map((abbr, i) => {
                            const d = DRIVERS.find(x => x.id === abbr)
                            const col = d ? TEAM_COLORS[d.team] || T.amber : T.rule
                            return (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <div style={{ width: 3, height: 8, background: col }} />
                                <span className="pw-mono" style={{ fontSize: 7, color: T.dim }}>{abbr}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── LAST RACE (China GP) ── */}
            {rightTab === 'lastrace' && (
              <>
                {/* Race header */}
                <div style={{ padding: '8px 10px', background: T.sunk, border: `1px solid ${T.ruleStrong}`, marginBottom: 2 }}>
                  <div style={{ fontSize: 8, letterSpacing: '0.14em', color: T.faint, marginBottom: 4 }}>CHINESE GP · ROUND 5 · SHANGHAI · MAR 23 2026</div>
                  <div style={{ fontSize: 8, letterSpacing: '0.1em', color: T.dim, marginBottom: 3 }}>ACTUAL RESULT</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {CHINA_ACTUAL.map((abbr, i) => {
                      const d = DRIVERS.find(x => x.id === abbr)
                      const col = d ? TEAM_COLORS[d.team] || T.amber : T.rule
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <div style={{ width: 3, height: 8, background: col }} />
                          <span style={{ fontSize: 7, color: T.faint }}>P{i+1}</span>
                          <span className="pw-mono" style={{ fontSize: 8, fontWeight: 700, color: T.text }}>{abbr}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Scored leaderboard */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1 }}>
                  {CHINA_SCORED.map((entry, idx) => {
                    const medal = ['🥇', '🥈', '🥉', ''][idx] ?? ''
                    return (
                      <div
                        key={entry.name}
                        onClick={() => setExpandedPick({ player_name: entry.name, picks: entry.picks, actual: CHINA_ACTUAL, race: 'Chinese Grand Prix · Round 5' })}
                        style={{
                          padding: '8px 10px', cursor: 'pointer',
                          background: idx === 0 ? 'rgba(245,166,35,0.08)' : T.sunk,
                          border: `1px solid ${idx === 0 ? T.amber : T.rule}`,
                          borderLeft: `3px solid ${idx === 0 ? T.amber : idx === 1 ? 'rgba(200,200,200,0.4)' : idx === 2 ? 'rgba(180,120,40,0.5)' : 'transparent'}`,
                          transition: 'background 100ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.1)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx === 0 ? 'rgba(245,166,35,0.08)' : T.sunk }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="pw-mono" style={{ fontSize: 9, fontWeight: 700, color: T.faint }}>#{idx+1}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{medal} {entry.name}</span>
                          </div>
                          <span className="pw-mono" style={{ fontSize: 12, fontWeight: 800, color: T.amber }}>{entry.total} pts</span>
                        </div>
                        {/* Mini picks with result coloring */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {entry.picks.map((abbr, i) => {
                            const d = DRIVERS.find(x => x.id === abbr)
                            const col = d ? TEAM_COLORS[d.team] || T.amber : T.rule
                            const exact = CHINA_ACTUAL[i] === abbr
                            const inTop5 = CHINA_ACTUAL.includes(abbr)
                            return (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <div style={{ width: 3, height: 8, background: col }} />
                                <span className="pw-mono" style={{ fontSize: 7, color: exact ? T.ok : inTop5 ? T.amber : T.hot }}>{abbr}</span>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ marginTop: 3 }}>
                          <span style={{ fontSize: 8, color: T.faint }}>click to see full breakdown</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <div style={{
        height: 26, borderTop: `1px solid ${T.rule}`,
        display: 'flex', alignItems: 'center', flexShrink: 0,
        fontSize: 9, color: T.faint, fontFamily: 'JetBrains Mono, monospace',
      }}>
        <div style={{ padding: '0 12px', borderRight: `1px solid ${T.rule}`, color: locked ? T.ok : T.amber }}>
          {locked ? '● PICKS LOCKED' : '● PICKS OPEN'}
        </div>
        <div style={{ padding: '0 12px', borderRight: `1px solid ${T.rule}` }}>
          {leaderboard.length} picks · {nextRace?.race_name ?? '—'}
        </div>
        <div style={{ padding: '0 12px', borderRight: `1px solid ${T.rule}` }}>
          {nextRace ? `round ${nextRace.round} · ${nextRace.season} season` : 'loading...'}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 12px', borderLeft: `1px solid ${T.rule}` }}>
          f1 predictor game · picks reset each race
        </div>
      </div>
    </div>
  )
}
