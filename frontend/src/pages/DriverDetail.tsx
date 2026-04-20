import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Activity, AlertTriangle, Users } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useSeason } from '../contexts/SeasonContext'
import { getDriver, getDriverHistory, getDriverRatings, type Driver, type DriverRaceHistory, type DriverRating } from '../api/client'

const RED = '#EE3F2C'
const TEAM_COLORS: Record<string, string> = {
  red_bull: '#3671C6', ferrari: '#E8002D', mercedes: '#27F4D2',
  mclaren: '#FF8000', aston_martin: '#358C75', alpine: '#FF87BC',
  williams: '#64C4FF', rb: '#6692FF', haas: '#B6BABD', sauber: '#52E252',
}

function guessTeam(name: string): string {
  const map: Record<string, string> = {
    verstappen: 'red_bull', perez: 'red_bull',
    leclerc: 'ferrari', sainz: 'ferrari', hamilton: 'ferrari',
    russell: 'mercedes', antonelli: 'mercedes',
    norris: 'mclaren', piastri: 'mclaren',
    alonso: 'aston_martin', stroll: 'aston_martin',
    ocon: 'alpine', gasly: 'alpine',
    albon: 'williams',
    tsunoda: 'rb', lawson: 'rb',
    magnussen: 'haas', hulkenberg: 'haas', bearman: 'haas',
    bottas: 'sauber', zhou: 'sauber', bortoleto: 'sauber',
  }
  const last = name.split(' ').pop()?.toLowerCase() ?? ''
  return map[last] ?? 'haas'
}

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { season } = useSeason()

  const [driver, setDriver] = useState<Driver | null>(null)
  const [history, setHistory] = useState<DriverRaceHistory[]>([])
  const [rating, setRating] = useState<DriverRating | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    Promise.all([
      getDriver(id),
      getDriverHistory(id),
      getDriverRatings(id, season),
    ]).then(([d, h, r]) => {
      setDriver(d)
      setHistory(h)
      setRating(r)
      setLoading(false)
    }).catch(err => {
      setError(err.message ?? 'Failed to load driver')
      setLoading(false)
    })
  }, [id, season])

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading driver data...</div>
  )
  if (error || !driver) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <p style={{ marginBottom: '16px' }}>{error ?? 'Driver not found'}</p>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', padding: '8px 16px', color: 'var(--text-secondary)', fontFamily: 'Rubik, sans-serif' }}>← Back</button>
    </div>
  )

  const team = guessTeam(driver.name)
  const teamColor = TEAM_COLORS[team] ?? '#888'

  // Race history for current season
  const seasonHistory = history.filter(r => r.season === season).sort((a, b) => a.round - b.round)

  // Stats
  const races = seasonHistory.length
  const wins = seasonHistory.filter(r => r.finish_position === 1).length
  const podiums = seasonHistory.filter(r => (r.finish_position ?? 99) <= 3).length
  const dnfs = seasonHistory.filter(r => r.dnf).length
  const totalPoints = seasonHistory.reduce((s, r) => s + (r.points ?? 0), 0)

  // Points fan chart (cumulative)
  const pointsData = seasonHistory.map((r, i) => {
    const cumulative = seasonHistory.slice(0, i + 1).reduce((s, rr) => s + (rr.points ?? 0), 0)
    return {
      round: `R${r.round}`,
      points: cumulative,
      best: cumulative + (rating?.consistency ?? 0.5) * 25 * (i + 1) / seasonHistory.length,
      worst: Math.max(0, cumulative - (1 - (rating?.consistency ?? 0.5)) * 15 * (i + 1) / seasonHistory.length),
    }
  })

  // Radar data
  const radarData = rating ? [
    { axis: 'Pace', value: Math.round(rating.base_pace * 100) },
    { axis: 'Consistency', value: Math.round(rating.consistency * 100) },
    { axis: 'Wet Skill', value: Math.round(rating.wet_skill * 100) },
    { axis: 'Tyre Mgmt', value: Math.round(rating.tyre_management * 100) },
    { axis: 'Overtake', value: Math.round(rating.overtake_skill * 100) },
    { axis: 'Qualifying', value: Math.round(rating.qualifying_pace * 100) },
    { axis: 'Reliability', value: Math.round((1 - rating.mechanical_dnf_rate) * 100) },
    { axis: 'Teammate', value: Math.round(((rating.teammate_index ?? 0) + 1) * 50) },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px',
          fontFamily: 'Rubik, sans-serif', padding: 0, alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={14} />
        Back to Championship
      </button>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `3px solid ${teamColor}`, padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '64px', height: '64px', background: `${teamColor}22`, border: `2px solid ${teamColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '20px', fontWeight: 800, color: teamColor, letterSpacing: '-0.04em' }}>
            {driver.abbreviation ?? driver.name.split(' ').map(p => p[0]).join('').slice(0, 3)}
          </span>
        </div>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1 }}>
            {driver.name}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            <span style={{ color: teamColor }}>{team.replace('_', ' ').toUpperCase()}</span>
            {driver.nationality && <> · {driver.nationality}</>}
            {' '} · {season} Season
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        {[
          { label: 'Points', value: totalPoints.toFixed(0), icon: TrendingUp },
          { label: 'Podiums', value: podiums, icon: Activity },
          { label: 'Wins', value: wins, icon: TrendingUp },
          { label: 'DNF Rate', value: races > 0 ? `${((dnfs / races) * 100).toFixed(0)}%` : '—', icon: AlertTriangle },
          { label: 'Races', value: races, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `2px solid ${RED}`, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              <Icon size={12} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Radar chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Performance Ratings
          </div>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Rubik, sans-serif' }} />
                <Radar dataKey="value" stroke={teamColor} fill={teamColor} fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: teamColor }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No rating data for {season}
            </div>
          )}
        </div>

        {/* Points trajectory */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Points Trajectory
          </div>
          {pointsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={pointsData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="round" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'Rubik, sans-serif' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'Rubik, sans-serif' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '12px', fontFamily: 'Rubik, sans-serif' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-secondary)' }}
                />
                <defs>
                  <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={RED} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={RED} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="best" stroke="none" fill="url(#rangeGrad)" strokeWidth={0} activeDot={false} legendType="none" />
                <Area type="monotone" dataKey="worst" stroke="none" fill="var(--bg-primary)" strokeWidth={0} activeDot={false} legendType="none" />
                <Area type="monotone" dataKey="points" stroke={teamColor} strokeWidth={2} fill="none" dot={{ r: 3, fill: teamColor }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No race data for {season}
            </div>
          )}
        </div>
      </div>

      {/* Race results table */}
      {seasonHistory.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {season} Race Results
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 60px 60px 70px', padding: '8px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
            {['RND', 'CIRCUIT', 'GRID', 'FIN', 'PTS'].map(h => (
              <span key={h} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</span>
            ))}
          </div>
          {seasonHistory.map(r => (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 60px 60px 70px',
              padding: '10px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center',
              background: r.finish_position === 1 ? 'rgba(238,63,44,0.04)' : 'transparent',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.round}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.circuit_id?.slice(0, 20)}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.grid_position ?? '—'}</span>
              <span style={{
                fontSize: '13px', fontWeight: r.finish_position !== null && r.finish_position <= 3 ? 700 : 400,
                color: r.dnf ? 'var(--text-muted)' : r.finish_position === 1 ? RED : r.finish_position !== null && r.finish_position <= 3 ? '#f59e0b' : 'var(--text-primary)',
              }}>
                {r.dnf ? 'DNF' : r.finish_position ?? '—'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: r.points > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {r.points > 0 ? r.points : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
