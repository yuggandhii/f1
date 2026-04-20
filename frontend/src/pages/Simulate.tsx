import { useEffect, useRef, useState, useMemo } from 'react'
import { useSeason } from '../contexts/SeasonContext'
import {
  runSimulation, getDriverProbabilities, listSimulations,
  getConstructorProbabilities, getSeasonCalendar,
  type DriverResult, type SimulationRun, type ConstructorResult,
  type CalendarRace,
} from '../api/client'
import { useSimulationProgress } from '../hooks/useSimulationProgress'

// ─── Theme hook ───────────────────────────────────────────────────────────────
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

// ─── Static race/season data ──────────────────────────────────────────────────
interface Race { r: number; name: string; short: string; date?: string; winner?: string; pred?: string; conf?: number }
interface SeasonMeta { rounds: number; champion: string | null; runnerUp: string | null }
interface StandingsRow { id: string; pts: number; wdc: number; podium: number; dnf: number; std: number }

const SEASONS_META: Record<number, SeasonMeta> = {
  2021: { rounds: 22, champion: 'VER', runnerUp: 'HAM' },
  2022: { rounds: 22, champion: 'VER', runnerUp: 'LEC' },
  2023: { rounds: 22, champion: 'VER', runnerUp: 'PER' },
  2024: { rounds: 24, champion: 'VER', runnerUp: 'NOR' },
  2025: { rounds: 24, champion: 'NOR', runnerUp: 'PIA' },
  2026: { rounds: 24, champion: null,  runnerUp: null  },
}

const SEASON_RACES: Record<number, Race[]> = {
  2021: [
    { r:1,  name:'Bahrain',        short:'BHR', winner:'HAM' },
    { r:2,  name:'Emilia-Romagna', short:'IMO', winner:'VER' },
    { r:3,  name:'Portugal',       short:'POR', winner:'HAM' },
    { r:4,  name:'Spain',          short:'ESP', winner:'HAM' },
    { r:5,  name:'Monaco',         short:'MON', winner:'VER' },
    { r:6,  name:'Azerbaijan',     short:'AZE', winner:'PER' },
    { r:7,  name:'France',         short:'FRA', winner:'VER' },
    { r:8,  name:'Styria',         short:'STY', winner:'VER' },
    { r:9,  name:'Austria',        short:'AUT', winner:'VER' },
    { r:10, name:'Britain',        short:'GBR', winner:'HAM' },
    { r:11, name:'Hungary',        short:'HUN', winner:'OCO' },
    { r:12, name:'Belgium',        short:'BEL', winner:'VER' },
    { r:13, name:'Netherlands',    short:'NED', winner:'VER' },
    { r:14, name:'Italy',          short:'ITA', winner:'RIC' },
    { r:15, name:'Russia',         short:'RUS', winner:'HAM' },
    { r:16, name:'Turkey',         short:'TUR', winner:'BOT' },
    { r:17, name:'Austin',         short:'USA', winner:'VER' },
    { r:18, name:'Mexico',         short:'MEX', winner:'VER' },
    { r:19, name:'São Paulo',      short:'BRA', winner:'HAM' },
    { r:20, name:'Qatar',          short:'QAT', winner:'HAM' },
    { r:21, name:'Saudi Arabia',   short:'SAU', winner:'HAM' },
    { r:22, name:'Abu Dhabi',      short:'ABU', winner:'VER' },
  ],
  2022: [
    { r:1,  name:'Bahrain',        short:'BHR', winner:'LEC' },
    { r:2,  name:'Saudi Arabia',   short:'SAU', winner:'VER' },
    { r:3,  name:'Australia',      short:'AUS', winner:'LEC' },
    { r:4,  name:'Emilia-Romagna', short:'IMO', winner:'VER' },
    { r:5,  name:'Miami',          short:'MIA', winner:'VER' },
    { r:6,  name:'Spain',          short:'ESP', winner:'VER' },
    { r:7,  name:'Monaco',         short:'MON', winner:'PER' },
    { r:8,  name:'Azerbaijan',     short:'AZE', winner:'VER' },
    { r:9,  name:'Canada',         short:'CAN', winner:'VER' },
    { r:10, name:'Britain',        short:'GBR', winner:'SAI' },
    { r:11, name:'Austria',        short:'AUT', winner:'LEC' },
    { r:12, name:'France',         short:'FRA', winner:'VER' },
    { r:13, name:'Hungary',        short:'HUN', winner:'VER' },
    { r:14, name:'Belgium',        short:'BEL', winner:'VER' },
    { r:15, name:'Netherlands',    short:'NED', winner:'VER' },
    { r:16, name:'Italy',          short:'ITA', winner:'VER' },
    { r:17, name:'Singapore',      short:'SGP', winner:'PER' },
    { r:18, name:'Japan',          short:'JPN', winner:'VER' },
    { r:19, name:'Austin',         short:'USA', winner:'VER' },
    { r:20, name:'Mexico',         short:'MEX', winner:'VER' },
    { r:21, name:'São Paulo',      short:'BRA', winner:'RUS' },
    { r:22, name:'Abu Dhabi',      short:'ABU', winner:'VER' },
  ],
  2023: [
    { r:1,  name:'Bahrain',        short:'BHR', winner:'VER' },
    { r:2,  name:'Saudi Arabia',   short:'SAU', winner:'PER' },
    { r:3,  name:'Australia',      short:'AUS', winner:'VER' },
    { r:4,  name:'Azerbaijan',     short:'AZE', winner:'PER' },
    { r:5,  name:'Miami',          short:'MIA', winner:'VER' },
    { r:6,  name:'Monaco',         short:'MON', winner:'VER' },
    { r:7,  name:'Spain',          short:'ESP', winner:'VER' },
    { r:8,  name:'Canada',         short:'CAN', winner:'VER' },
    { r:9,  name:'Austria',        short:'AUT', winner:'VER' },
    { r:10, name:'Britain',        short:'GBR', winner:'VER' },
    { r:11, name:'Hungary',        short:'HUN', winner:'VER' },
    { r:12, name:'Belgium',        short:'BEL', winner:'VER' },
    { r:13, name:'Netherlands',    short:'NED', winner:'VER' },
    { r:14, name:'Italy',          short:'ITA', winner:'VER' },
    { r:15, name:'Singapore',      short:'SGP', winner:'SAI' },
    { r:16, name:'Japan',          short:'JPN', winner:'VER' },
    { r:17, name:'Qatar',          short:'QAT', winner:'VER' },
    { r:18, name:'Austin',         short:'USA', winner:'VER' },
    { r:19, name:'Mexico',         short:'MEX', winner:'VER' },
    { r:20, name:'São Paulo',      short:'BRA', winner:'VER' },
    { r:21, name:'Las Vegas',      short:'LAS', winner:'VER' },
    { r:22, name:'Abu Dhabi',      short:'ABU', winner:'VER' },
  ],
  2024: [
    { r:1,  name:'Bahrain',        short:'BHR', winner:'VER' },
    { r:2,  name:'Saudi Arabia',   short:'SAU', winner:'VER' },
    { r:3,  name:'Australia',      short:'AUS', winner:'SAI' },
    { r:4,  name:'Japan',          short:'JPN', winner:'VER' },
    { r:5,  name:'China',          short:'CHN', winner:'VER' },
    { r:6,  name:'Miami',          short:'MIA', winner:'NOR' },
    { r:7,  name:'Emilia-Romagna', short:'IMO', winner:'VER' },
    { r:8,  name:'Monaco',         short:'MON', winner:'LEC' },
    { r:9,  name:'Canada',         short:'CAN', winner:'VER' },
    { r:10, name:'Spain',          short:'ESP', winner:'VER' },
    { r:11, name:'Austria',        short:'AUT', winner:'RUS' },
    { r:12, name:'Britain',        short:'GBR', winner:'HAM' },
    { r:13, name:'Hungary',        short:'HUN', winner:'PIA' },
    { r:14, name:'Belgium',        short:'BEL', winner:'HAM' },
    { r:15, name:'Netherlands',    short:'NED', winner:'NOR' },
    { r:16, name:'Italy',          short:'ITA', winner:'LEC' },
    { r:17, name:'Azerbaijan',     short:'AZE', winner:'PIA' },
    { r:18, name:'Singapore',      short:'SGP', winner:'NOR' },
    { r:19, name:'Austin',         short:'USA', winner:'LEC' },
    { r:20, name:'Mexico',         short:'MEX', winner:'SAI' },
    { r:21, name:'São Paulo',      short:'BRA', winner:'VER' },
    { r:22, name:'Las Vegas',      short:'LAS', winner:'RUS' },
    { r:23, name:'Qatar',          short:'QAT', winner:'VER' },
    { r:24, name:'Abu Dhabi',      short:'ABU', winner:'NOR' },
  ],
  2025: [
    { r:1,  name:'Australia',      short:'AUS', winner:'NOR' },
    { r:2,  name:'China',          short:'CHN', winner:'PIA' },
    { r:3,  name:'Japan',          short:'JPN', winner:'VER' },
    { r:4,  name:'Bahrain',        short:'BHR', winner:'PIA' },
    { r:5,  name:'Saudi Arabia',   short:'SAU', winner:'PIA' },
    { r:6,  name:'Miami',          short:'MIA', winner:'PIA' },
    { r:7,  name:'Emilia-Romagna', short:'IMO', winner:'VER' },
    { r:8,  name:'Monaco',         short:'MON', winner:'NOR' },
    { r:9,  name:'Spain',          short:'ESP', winner:'PIA' },
    { r:10, name:'Canada',         short:'CAN', winner:'RUS' },
    { r:11, name:'Austria',        short:'AUT', winner:'NOR' },
    { r:12, name:'Britain',        short:'GBR', winner:'NOR' },
    { r:13, name:'Belgium',        short:'BEL', winner:'PIA' },
    { r:14, name:'Hungary',        short:'HUN', winner:'NOR' },
    { r:15, name:'Netherlands',    short:'NED', winner:'PIA' },
    { r:16, name:'Italy',          short:'ITA', winner:'NOR' },
    { r:17, name:'Azerbaijan',     short:'AZE', winner:'VER' },
    { r:18, name:'Singapore',      short:'SGP', winner:'RUS' },
    { r:19, name:'Austin',         short:'USA', winner:'NOR' },
    { r:20, name:'Mexico',         short:'MEX', winner:'LEC' },
    { r:21, name:'São Paulo',      short:'BRA', winner:'PIA' },
    { r:22, name:'Las Vegas',      short:'LAS', winner:'NOR' },
    { r:23, name:'Qatar',          short:'QAT', winner:'PIA' },
    { r:24, name:'Abu Dhabi',      short:'ABU', winner:'NOR' },
  ],
  // 2026: predicted data for future races; actual winners overridden from Jolpica
  2026: [
    { r:1,  name:'Bahrain',        short:'BHR' },
    { r:2,  name:'Saudi Arabia',   short:'SAU' },
    { r:3,  name:'Australia',      short:'AUS' },
    { r:4,  name:'Japan',          short:'JPN' },
    { r:5,  name:'China',          short:'CHN' },
    { r:6,  name:'Miami',          short:'MIA' },
    { r:7,  name:'Imola',          short:'IMO', pred:'NOR', conf:0.38 },
    { r:8,  name:'Monaco',         short:'MON', pred:'LEC', conf:0.34 },
    { r:9,  name:'Spain',          short:'ESP', pred:'NOR', conf:0.36 },
    { r:10, name:'Canada',         short:'CAN', pred:'VER', conf:0.33 },
    { r:11, name:'Austria',        short:'AUT', pred:'NOR', conf:0.35 },
    { r:12, name:'Britain',        short:'GBR', pred:'NOR', conf:0.41 },
    { r:13, name:'Hungary',        short:'HUN', pred:'NOR', conf:0.41 },
    { r:14, name:'Belgium',        short:'BEL', pred:'VER', conf:0.38 },
    { r:15, name:'Netherlands',    short:'NED', pred:'VER', conf:0.44 },
    { r:16, name:'Italy',          short:'ITA', pred:'NOR', conf:0.36 },
    { r:17, name:'Azerbaijan',     short:'AZE', pred:'PIA', conf:0.29 },
    { r:18, name:'Singapore',      short:'SGP', pred:'NOR', conf:0.42 },
    { r:19, name:'Austin',         short:'USA', pred:'NOR', conf:0.35 },
    { r:20, name:'Mexico',         short:'MEX', pred:'VER', conf:0.40 },
    { r:21, name:'São Paulo',      short:'BRA', pred:'NOR', conf:0.33 },
    { r:22, name:'Las Vegas',      short:'LAS', pred:'VER', conf:0.37 },
    { r:23, name:'Qatar',          short:'QAT', pred:'VER', conf:0.43 },
    { r:24, name:'Abu Dhabi',      short:'ABU', pred:'NOR', conf:0.31 },
  ],
}

const DRIVERS_EXT: Record<string, { name: string; team: string; abbr: string }> = {
  NOR: { name:'Lando Norris',      team:'McLaren',      abbr:'NOR' },
  VER: { name:'Max Verstappen',    team:'Red Bull',     abbr:'VER' },
  PIA: { name:'Oscar Piastri',     team:'McLaren',      abbr:'PIA' },
  LEC: { name:'Charles Leclerc',  team:'Ferrari',      abbr:'LEC' },
  RUS: { name:'George Russell',   team:'Mercedes',     abbr:'RUS' },
  HAM: { name:'Lewis Hamilton',   team:'Ferrari',      abbr:'HAM' },
  ANT: { name:'Kimi Antonelli',   team:'Mercedes',     abbr:'ANT' },
  SAI: { name:'Carlos Sainz',     team:'Williams',     abbr:'SAI' },
  ALO: { name:'Fernando Alonso',  team:'Aston Martin', abbr:'ALO' },
  GAS: { name:'Pierre Gasly',     team:'Alpine',       abbr:'GAS' },
  PER: { name:'Sergio Pérez',     team:'Red Bull',     abbr:'PER' },
  OCO: { name:'Esteban Ocon',     team:'Alpine',       abbr:'OCO' },
  RIC: { name:'Daniel Ricciardo', team:'McLaren',      abbr:'RIC' },
  BOT: { name:'Valtteri Bottas',  team:'Mercedes',     abbr:'BOT' },
}

const TEAM_COLORS: Record<string, string> = {
  'McLaren':      '#FF6B1A',
  'Red Bull':     '#1E5BD8',
  'Ferrari':      '#D31E29',
  'Mercedes':     '#00B8A9',
  'Williams':     '#3B9BE5',
  'Aston Martin': '#2E7D5C',
  'Alpine':       '#E879A8',
  'RB':           '#5C7FE5',
  'Haas':         '#9CA3AF',
  'Sauber':       '#4ADE80',
}

const MOCK_STANDINGS_2026: Record<number, StandingsRow[]> = {
  6: [
    { id:'NOR', pts:138, wdc:0.36, podium:0.72, dnf:0.03, std:22 },
    { id:'VER', pts:121, wdc:0.30, podium:0.58, dnf:0.05, std:24 },
    { id:'PIA', pts:109, wdc:0.18, podium:0.54, dnf:0.05, std:26 },
    { id:'LEC', pts: 88, wdc:0.09, podium:0.38, dnf:0.08, std:29 },
    { id:'RUS', pts: 72, wdc:0.04, podium:0.32, dnf:0.07, std:27 },
    { id:'HAM', pts: 64, wdc:0.02, podium:0.28, dnf:0.09, std:31 },
    { id:'ANT', pts: 52, wdc:0.008, podium:0.19, dnf:0.12, std:34 },
    { id:'SAI', pts: 31, wdc:0.003, podium:0.09, dnf:0.09, std:22 },
  ],
  12: [
    { id:'NOR', pts:298, wdc:0.342, podium:0.68, dnf:0.04, std:24 },
    { id:'VER', pts:274, wdc:0.287, podium:0.61, dnf:0.06, std:27 },
    { id:'PIA', pts:240, wdc:0.181, podium:0.55, dnf:0.05, std:26 },
    { id:'LEC', pts:203, wdc:0.094, podium:0.44, dnf:0.08, std:31 },
    { id:'RUS', pts:168, wdc:0.052, podium:0.38, dnf:0.07, std:28 },
    { id:'HAM', pts:142, wdc:0.028, podium:0.31, dnf:0.09, std:33 },
    { id:'ANT', pts:118, wdc:0.010, podium:0.22, dnf:0.12, std:35 },
    { id:'SAI', pts: 72, wdc:0.004, podium:0.11, dnf:0.09, std:22 },
  ],
}

const MOCK_SPARKS: Record<string, number[]> = {
  NOR: [0.18,0.22,0.25,0.21,0.28,0.31,0.29,0.33,0.30,0.34,0.34,0.342],
  VER: [0.52,0.48,0.44,0.41,0.38,0.34,0.35,0.31,0.30,0.29,0.29,0.287],
  PIA: [0.12,0.14,0.15,0.17,0.16,0.18,0.17,0.18,0.19,0.18,0.18,0.181],
  LEC: [0.08,0.07,0.08,0.10,0.09,0.09,0.10,0.09,0.10,0.10,0.09,0.094],
  RUS: [0.05,0.04,0.04,0.05,0.05,0.04,0.05,0.05,0.05,0.05,0.05,0.052],
}

function genSpark(wdc: number, std: number, seed: number): number[] {
  const n = 12
  const variance = Math.min(0.15, std / 600)
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const noise = (Math.sin(i * 2.1 + seed) * 0.4 + Math.cos(i * 3.7 + seed) * 0.3) * variance
    return Math.max(0, wdc * (0.4 + 0.6 * t) + noise)
  })
}

const MOCK_STANDINGS_HIST: Record<number, StandingsRow[]> = {
  2021: [
    { id:'VER', pts:395, wdc:0.52, podium:0.86, dnf:0.05, std:24 },
    { id:'HAM', pts:387, wdc:0.48, podium:0.86, dnf:0.04, std:24 },
    { id:'BOT', pts:226, wdc:0.00, podium:0.62, dnf:0.07, std:35 },
    { id:'PER', pts:190, wdc:0.00, podium:0.48, dnf:0.10, std:40 },
    { id:'SAI', pts:164, wdc:0.00, podium:0.40, dnf:0.09, std:38 },
    { id:'LEC', pts:159, wdc:0.00, podium:0.38, dnf:0.12, std:42 },
    { id:'NOR', pts:160, wdc:0.00, podium:0.42, dnf:0.07, std:38 },
    { id:'RIC', pts:115, wdc:0.00, podium:0.22, dnf:0.08, std:40 },
  ],
  2022: [
    { id:'VER', pts:454, wdc:0.92, podium:0.91, dnf:0.03, std:18 },
    { id:'LEC', pts:308, wdc:0.05, podium:0.70, dnf:0.10, std:30 },
    { id:'PER', pts:305, wdc:0.02, podium:0.68, dnf:0.07, std:28 },
    { id:'RUS', pts:275, wdc:0.005, podium:0.62, dnf:0.03, std:26 },
    { id:'SAI', pts:246, wdc:0.003, podium:0.56, dnf:0.09, std:32 },
    { id:'HAM', pts:240, wdc:0.002, podium:0.55, dnf:0.05, std:30 },
    { id:'ALO', pts:81,  wdc:0.001, podium:0.18, dnf:0.09, std:42 },
    { id:'BOT', pts:49,  wdc:0.001, podium:0.11, dnf:0.11, std:45 },
  ],
  2023: [
    { id:'VER', pts:575, wdc:0.97, podium:0.95, dnf:0.02, std:12 },
    { id:'PER', pts:285, wdc:0.02, podium:0.72, dnf:0.05, std:28 },
    { id:'ALO', pts:206, wdc:0.004, podium:0.57, dnf:0.07, std:35 },
    { id:'HAM', pts:234, wdc:0.003, podium:0.60, dnf:0.06, std:30 },
    { id:'SAI', pts:200, wdc:0.002, podium:0.55, dnf:0.08, std:32 },
    { id:'LEC', pts:206, wdc:0.002, podium:0.58, dnf:0.09, std:34 },
    { id:'NOR', pts:205, wdc:0.001, podium:0.54, dnf:0.07, std:30 },
    { id:'RUS', pts:160, wdc:0.001, podium:0.44, dnf:0.05, std:35 },
  ],
  2024: [
    { id:'NOR', pts:374, wdc:0.60, podium:0.78, dnf:0.03, std:22 },
    { id:'VER', pts:437, wdc:0.34, podium:0.82, dnf:0.06, std:25 },
    { id:'LEC', pts:356, wdc:0.04, podium:0.72, dnf:0.07, std:30 },
    { id:'PIA', pts:292, wdc:0.02, podium:0.62, dnf:0.04, std:28 },
    { id:'SAI', pts:290, wdc:0.00, podium:0.60, dnf:0.08, std:32 },
    { id:'RUS', pts:235, wdc:0.00, podium:0.50, dnf:0.05, std:30 },
    { id:'HAM', pts:211, wdc:0.00, podium:0.46, dnf:0.06, std:32 },
    { id:'ALO', pts:70,  wdc:0.00, podium:0.15, dnf:0.10, std:45 },
  ],
  2025: [
    { id:'NOR', pts:442, wdc:0.62, podium:0.88, dnf:0.03, std:22 },
    { id:'PIA', pts:356, wdc:0.30, podium:0.80, dnf:0.04, std:26 },
    { id:'VER', pts:289, wdc:0.06, podium:0.62, dnf:0.06, std:28 },
    { id:'LEC', pts:221, wdc:0.01, podium:0.52, dnf:0.07, std:32 },
    { id:'RUS', pts:196, wdc:0.005, podium:0.46, dnf:0.05, std:30 },
    { id:'HAM', pts:168, wdc:0.003, podium:0.40, dnf:0.08, std:34 },
    { id:'SAI', pts:142, wdc:0.001, podium:0.32, dnf:0.07, std:35 },
    { id:'ANT', pts:108, wdc:0.001, podium:0.24, dnf:0.11, std:38 },
  ],
}

function getMockStandings(season: number, cutoff: number): StandingsRow[] {
  if (season === 2026) {
    const keys = Object.keys(MOCK_STANDINGS_2026).map(Number).sort((a, b) => a - b)
    let chosen = keys[0]
    for (const k of keys) if (k <= cutoff) chosen = k
    return MOCK_STANDINGS_2026[chosen]
  }
  return MOCK_STANDINGS_HIST[season] ?? MOCK_STANDINGS_HIST[2025]
}

function teamColorFor(teamName: string | undefined): string {
  if (!teamName) return '#888'
  const direct = TEAM_COLORS[teamName]
  if (direct) return direct
  const key = teamName.toLowerCase()
  const found = Object.entries(TEAM_COLORS).find(([k]) => key.includes(k.toLowerCase()))
  return found ? found[1] : '#888'
}


// ─── Sub-components ───────────────────────────────────────────────────────────
function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
      fontWeight: 600, ...style,
    }}>
      {children}
    </div>
  )
}

function Pip({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      background: color, flexShrink: 0,
    }} />
  )
}

function Spark({ data, color, w = 60, h = 18 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />
  const min = Math.min(...data), max = Math.max(...data)
  const r = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / r) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" />
    </svg>
  )
}

function TooltipChip({
  label, tooltip, active: _active, onClick, style, containerStyle,
}: {
  label: string
  tooltip: string
  active: boolean
  onClick: () => void
  style: React.CSSProperties
  containerStyle?: React.CSSProperties
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', ...containerStyle }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={style}
      >
        {label}
      </button>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#fff', fontSize: 12,
          border: '1px solid rgba(255,255,255,0.15)',
          padding: '6px 10px', borderRadius: 2,
          whiteSpace: 'nowrap', zIndex: 50,
          animation: 'pw-fadein 150ms ease forwards',
          pointerEvents: 'none',
        }}>
          {tooltip}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(255,255,255,0.15)',
          }} />
          <div style={{
            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid #1a1a1a',
          }} />
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Simulate() {
  const isDark = useIsDark()
  const { season, setSeason } = useSeason()

  // ── State ───────────────────────────────────────────────────────────────────
  const [now, setNow] = useState(() => new Date())
  const [calendarRaces, setCalendarRaces] = useState<CalendarRace[]>([])
  const [cutoff, setCutoff] = useState(12)
  const [weather, setWeather] = useState<'HISTORICAL'|'DRY'|'RANDOM'|'MONSOON'>('HISTORICAL')
  const [reliability, setReliability] = useState<'HIST'|'OPT'|'PES'>('HIST')
  const [chaos, setChaos] = useState(0.15)
  const [nSims, setNSims] = useState(10000)
  const [dataRangeStart, setDataRangeStart] = useState(2022)
  const [dataRangeEnd, setDataRangeEnd] = useState(2026)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [results, setResults] = useState<DriverResult[]>([])
  const [constructors, setConstructors] = useState<ConstructorResult[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [_history, setHistory] = useState<SimulationRun[]>([])
  const prevStatus = useRef('')

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

  // ── Live clock (every second) ───────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Date/time display values ─────────────────────────────────────────────────
  const todayStr = now.toISOString().split('T')[0]  // "2026-04-19"

  const timeDisplay = useMemo(() => {
    try {
      return now.toLocaleTimeString('en-GB', {
        hour12: false, timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } catch { return now.toLocaleTimeString() }
  }, [now])

  const dateDisplay = useMemo(() => {
    try {
      return now.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
      }).replace(/\//g, '-')
    } catch { return '' }
  }, [now])

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const staticRaces = SEASON_RACES[season] ?? []

  useEffect(() => {
    setCalendarRaces([])
    getSeasonCalendar(season).then(races => setCalendarRaces(races)).catch(() => {})
  }, [season])

  // ── Build races array merging static + calendar ──────────────────────────────
  const races: Race[] = useMemo(() => {
    if (calendarRaces.length > 0) {
      return calendarRaces.map(r => {
        const static_ = staticRaces.find(s => s.short === r.short)
        return {
          r: r.round,
          name: r.name,
          short: r.short,
          date: r.date,
          winner: season !== 2026 ? static_?.winner : undefined,
          pred: static_?.pred,
          conf: static_?.conf,
        }
      })
    }
    return staticRaces.map(r => ({ ...r }))
  }, [calendarRaces, season, staticRaces])

  const meta  = SEASONS_META[season] ?? { rounds: 24, champion: null, runnerUp: null }
  const isLive = season === 2026

  // ── Last raced round (date-based for 2026) ───────────────────────────────────
  const lastRacedRound = useMemo(() => {
    if (season === 2026 && calendarRaces.length > 0) {
      const completed = calendarRaces.filter(r => r.date && r.date < todayStr)
      return completed.length > 0 ? Math.max(...completed.map(r => r.round)) : 0
    }
    let last = 0
    for (const r of races) if (r.winner) last = Math.max(last, r.r)
    return last
  }, [season, calendarRaces, races, todayStr])

  // ── Next race from calendar (date-based) ─────────────────────────────────────
  const nextRaceCalendar: CalendarRace | undefined = useMemo(() => {
    if (calendarRaces.length === 0) return undefined
    return calendarRaces.find(r => r.date && r.date >= todayStr)
  }, [calendarRaces, todayStr])

  // Short countdown for the race drawer badge: "13d 15h" or "2h 45m"
  const countdownShort = useMemo(() => {
    if (!nextRaceCalendar?.date) return null
    const target = new Date(nextRaceCalendar.date + 'T00:00:00Z')
    const diff = target.getTime() - now.getTime()
    if (diff <= 0) return 'today'
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    if (d > 0) return `${d}d ${h}h`
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }, [nextRaceCalendar, now])

  // ── Completed vs predicted counts for 2026 ──────────────────────────────────
  const completedCount = useMemo(() => {
    if (season === 2026 && calendarRaces.length > 0) {
      return calendarRaces.filter(r => r.date && r.date < todayStr).length
    }
    return races.filter(r => !!r.winner).length
  }, [season, calendarRaces, races, todayStr])

  // ── Set default cutoff ────────────────────────────────────────────────────────
  useEffect(() => {
    if (season !== 2026) {
      setCutoff(meta.rounds)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season])

  useEffect(() => {
    if (season === 2026 && lastRacedRound > 0) {
      setCutoff(lastRacedRound)
    }
  }, [season, lastRacedRound])


  // ── Sim progress ─────────────────────────────────────────────────────────────
  const progress = useSimulationProgress(activeRunId)
  const isRunning = progress.status === 'running' || progress.status === 'connecting'
  const isDone    = progress.status === 'done'

  useEffect(() => {
    setResults([])
    setConstructors([])
    setActiveRunId(null)
    listSimulations(season, 3).then(setHistory).catch(() => {})
  }, [season])

  useEffect(() => {
    if (isDone && prevStatus.current !== 'done' && activeRunId) {
      getDriverProbabilities(activeRunId).then(setResults).catch(() => {})
      getConstructorProbabilities(activeRunId).then(setConstructors).catch(() => {})
      listSimulations(season, 3).then(setHistory).catch(() => {})
    }
    prevStatus.current = progress.status
  }, [progress.status, activeRunId, season, isDone])

  async function handleRun() {
    // Always start fresh — previous run stays in DB history, display resets
    setActiveRunId(null)
    setResults([])
    setConstructors([])
    setSubmitting(true)
    setError(null)
    try {
      const { run_id } = await runSimulation({
        season,
        n_sims: nSims,
        randomness_factor: chaos,
        data_range_start: dataRangeStart,
        data_range_end: dataRangeEnd,
        cutoff_round: cutoff,
      })
      setActiveRunId(run_id)
    } catch (e: unknown) {
      const msg = (e as { response?: { status?: number } })?.response?.status === 502
        ? 'Backend unreachable — make sure Docker is running: docker compose up -d'
        : (e as { message?: string })?.message ?? 'Failed to start simulation'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const cutoffRace = races.find(r => r.r === cutoff)
  const nextRace   = races.find(r => r.r === cutoff + 1)
  const totalRounds = meta.rounds || races.length
  const progressPct = Math.min(1, cutoff / totalRounds)

  // ── Standings rows ────────────────────────────────────────────────────────────
  const standingsRows: StandingsRow[] = useMemo(() => {
    if (results.length > 0) {
      return results
        .map(r => ({
          id: r.driver_abbreviation || r.driver_name?.split(' ').pop()?.toUpperCase().slice(0, 3) || r.driver_id.slice(0, 3).toUpperCase(),
          pts: Math.round(r.expected_points ?? 0),
          wdc: r.wdc_probability ?? 0,
          podium: r.podium_rate ?? 0,
          dnf: r.dnf_rate_simulated ?? 0,
          std: Math.round(r.points_std ?? 20),
        }))
        .sort((a, b) => b.wdc - a.wdc)
    }
    return getMockStandings(season, cutoff)
  }, [results, season, cutoff])

  function driverTeamColor(abbr: string): string {
    if (results.length > 0) {
      const r = results.find(x => (x.driver_abbreviation || '') === abbr || (x.driver_name?.split(' ').pop()?.toUpperCase().slice(0,3) || '') === abbr)
      if (r?.team_name) return teamColorFor(r.team_name)
    }
    const d = DRIVERS_EXT[abbr]
    if (d) return TEAM_COLORS[d.team] || T.amber
    return T.amber
  }

  function driverInfo(abbr: string): { name: string; team: string; abbr: string } {
    if (results.length > 0) {
      const r = results.find(x => (x.driver_abbreviation || '') === abbr)
      if (r) return { name: r.driver_name || abbr, team: r.team_name || '', abbr }
    }
    return DRIVERS_EXT[abbr] || { name: abbr, team: 'Unknown', abbr }
  }


  const simProgress = isRunning ? progress.progress : (isDone ? 1 : 0)


  const chipBase: React.CSSProperties = {
    padding: '5px 10px', fontSize: 10, letterSpacing: '0.1em',
    fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
    transition: 'all 150ms ease', userSelect: 'none', border: 'none',
  }

  return (
    <div style={{
      width: '100%', height: 'calc(100vh - 44px)',
      background: T.bg, color: T.text,
      fontFamily: 'Inter, sans-serif', fontSize: 12,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── SEASON PICKER STRIP ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: `1px solid ${T.rule}`, flexShrink: 0,
      }}>

        {/* Top-left: Active Season */}
        <div style={{
          padding: '10px 20px', borderRight: `1px solid ${T.rule}`,
          display: 'flex', flexDirection: 'column', gap: 2, minWidth: 170,
        }}>
          <Label style={{ color: T.faint }}>active season</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span className="pw-mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: T.text, lineHeight: 1 }}>
              {season}
            </span>
            {isLive
              ? <span className="pw-mono" style={{ fontSize: 8, color: T.ok, letterSpacing: '0.14em', border: `1px solid ${T.ok}`, padding: '1px 5px' }}>● LIVE</span>
              : meta.champion && <span className="pw-mono" style={{ fontSize: 9, color: T.amber }}>★ {meta.champion}</span>
            }
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 16px', flex: 1 }}>
          {([2021, 2022, 2023, 2024, 2025, 2026] as const).map(s => {
            const on = s === season
            return (
              <button
                key={s}
                onClick={() => setSeason(s)}
                style={{
                  ...chipBase,
                  fontWeight: on ? 700 : 500,
                  background: on ? T.amber : 'transparent',
                  color: on ? '#0b0c0e' : T.dim,
                  border: `1px solid ${on ? T.amber : T.rule}`,
                  padding: '5px 12px', fontSize: 11,
                }}
              >
                {s}{s === 2026 && <span style={{ marginLeft: 5, fontSize: 7, color: on ? '#0b0c0e' : T.ok }}>●</span>}
              </button>
            )
          })}
          <div style={{ width: 1, height: 22, background: T.rule, margin: '0 6px' }} />
          <span className="pw-mono" style={{ fontSize: 9, color: T.dim, letterSpacing: '0.12em' }}>
            SIMULATE THROUGH
          </span>
          <div className="pw-mono" style={{
            fontSize: 12, color: T.amber, fontWeight: 700,
            padding: '4px 10px', background: T.amberDim, border: `1px solid ${T.amber}`,
          }}>
            R{String(cutoff).padStart(2,'0')} · {cutoffRace?.name?.toUpperCase() ?? '—'}
          </div>
        </div>

        <div style={{
          padding: '10px 20px', borderLeft: `1px solid ${T.rule}`, minWidth: 200,
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <Label style={{ color: T.faint }}>season progress</Label>
          <div className="pw-mono" style={{ fontSize: 12, color: T.text, marginTop: 2 }}>
            {cutoff} / {totalRounds}
            <span style={{ color: T.faint, marginLeft: 8 }}>· {Math.round(progressPct * 100)}%</span>
          </div>
          <div style={{ height: 3, background: T.rule, marginTop: 5, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progressPct * 100}%`, background: T.amber }} />
          </div>
        </div>
      </div>

      {/* ── RACE DRAWER ── */}
      <div style={{
        padding: '12px 18px 14px', borderBottom: `1px solid ${T.rule}`,
        background: T.panel, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <Label style={{ color: T.faint }}>{season} schedule · click any race to simulate through it</Label>
            {isLive
              ? <span className="pw-mono" style={{ fontSize: 8, color: T.dim }}>
                  {completedCount} raced · {races.length - completedCount} predicted
                  {nextRaceCalendar && countdownShort && (
                    <span style={{ color: T.amber }}> · NEXT: {nextRaceCalendar.short} in {countdownShort}</span>
                  )}
                </span>
              : <span className="pw-mono" style={{ fontSize: 8, color: T.dim }}>
                  all {races.length} rounds · champion <span style={{ color: T.amber }}>{meta.champion}</span>
                </span>
            }
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {[
              { swatch: T.amber, label: 'active cutoff' },
              { swatch: T.ok,    label: 'raced' },
              { swatch: 'transparent', label: 'predicted', border: T.dim },
            ].map(({ swatch, label, border }) => (
              <span key={label} className="pw-mono" style={{ fontSize: 8, color: T.faint, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 9, height: 9, background: swatch, border: border ? `1px solid ${border}` : undefined }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${races.length}, minmax(0, 1fr))`,
          gap: 3,
        }}>
          {races.map(race => {
            const isCompletedByDate = season === 2026 && race.date ? race.date < todayStr : !!race.winner
            const raced    = !!race.winner || (season === 2026 && isCompletedByDate)
            const isCutoff = race.r === cutoff
            const isAfter  = race.r > cutoff
            const winnerId = race.winner || race.pred
            const winnerTeam = DRIVERS_EXT[winnerId ?? '']?.team
            const winnerColor = winnerTeam ? TEAM_COLORS[winnerTeam] || T.amber : T.rule
            return (
              <div
                key={race.r}
                onClick={() => setCutoff(race.r)}
                title={`R${String(race.r).padStart(2,'0')} · ${race.name}${race.winner ? ` · Won by ${race.winner}` : race.pred ? ` · Predicted: ${race.pred}` : ''}`}
                style={{
                  cursor: 'pointer', position: 'relative', padding: '6px 3px 5px',
                  background: isCutoff ? T.amberDim : 'transparent',
                  border: `1px solid ${isCutoff ? T.amber : T.rule}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'all 100ms ease',
                }}
                onMouseEnter={e => { if (!isCutoff) (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.07)' }}
                onMouseLeave={e => { if (!isCutoff) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span className="pw-mono" style={{ fontSize: 7, color: T.faint, letterSpacing: '0.08em' }}>
                  R{String(race.r).padStart(2,'0')}
                </span>
                <span className="pw-mono" style={{ fontSize: 10, fontWeight: 700, color: isCutoff ? T.amber : T.text, letterSpacing: '0.03em' }}>
                  {race.short}
                </span>
                <div style={{ height: 2, width: '100%', background: T.rule, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: raced || isCutoff ? '100%' : isAfter ? '0' : '55%',
                    background: raced ? T.ok : T.amber,
                    opacity: isAfter && !isCutoff ? 0.2 : 1,
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 9 }}>
                  {winnerId
                    ? <><Pip color={winnerColor} size={4} /><span className="pw-mono" style={{ fontSize: 7, color: raced ? T.text : T.dim }}>{winnerId}</span></>
                    : isCompletedByDate && season === 2026
                      ? <span className="pw-mono" style={{ fontSize: 7, color: T.dim }}>···</span>
                      : <span className="pw-mono" style={{ fontSize: 7, color: T.faint }}>—</span>
                  }
                </div>
                {isCutoff && <div style={{ position: 'absolute', left: -1, right: -1, bottom: -1, height: 2, background: T.amber }} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── HERO / SIM PROGRESS ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '260px 1fr 260px',
        borderBottom: `1px solid ${T.rule}`, flexShrink: 0,
      }}>
        {/* Run signature card */}
        <div style={{ padding: '8px 10px 8px', borderRight: `1px solid ${T.rule}` }}>
          <div style={{
            background: T.sunk, border: `1px solid ${T.ruleStrong}`,
            padding: '8px 10px', position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -1, left: -1, right: -1, height: 2, background: T.amber }} />
            <Label style={{ color: T.faint }}>run signature</Label>
            <div className="pw-mono" style={{ fontSize: 11, marginTop: 4, letterSpacing: '0.02em' }}>
              r_{season}_R{String(cutoff).padStart(2,'0')}_<span style={{ color: T.amber }}>3fe1</span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 7 }}>
              {[['m.c.', nSims.toLocaleString()], ['chaos', chaos.toFixed(2)], ['weather', weather.slice(0,4)]].map(([k, v]) => (
                <div key={k}>
                  <Label style={{ color: T.faint }}>{k}</Label>
                  <div className="pw-mono" style={{ fontSize: 11, marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress center */}
        <div style={{ padding: '12px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Label style={{ color: T.faint }}>
                {isRunning ? 'simulating through' : 'snapshot at'} · R{String(cutoff).padStart(2,'0')} {cutoffRace?.name}
              </Label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 5 }}>
                <div className="pw-mono" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: T.amber }}>
                  {isRunning ? Math.round(simProgress * 100) : (isDone || results.length > 0 ? 100 : '—')}
                </div>
                <div className="pw-mono" style={{ fontSize: 16, color: T.amber, lineHeight: 1 }}>%</div>
                <div style={{ marginLeft: 12 }}>
                  <div className="pw-mono" style={{ fontSize: 10, color: T.dim }}>
                    {isRunning
                      ? `${Math.round(simProgress * nSims).toLocaleString()} / ${nSims.toLocaleString()} paths`
                      : isDone || results.length > 0
                        ? `${nSims.toLocaleString()} paths complete`
                        : 'configure and run →'
                    }
                  </div>
                  {error && <div className="pw-mono" style={{ fontSize: 10, color: T.hot, marginTop: 2 }}>{error}</div>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                onClick={handleRun}
                disabled={submitting || isRunning}
                style={{
                  background: T.amberDim, border: `1px solid ${T.amber}`,
                  color: T.amber, padding: '5px 14px', fontSize: 9, letterSpacing: '0.1em',
                  textTransform: 'uppercase', cursor: submitting || isRunning ? 'not-allowed' : 'pointer',
                  opacity: submitting || isRunning ? 0.6 : 1,
                }}
              >
                {isRunning ? 'Simulating…' : submitting ? 'Queuing…' : isDone || results.length > 0 ? '↺ Re-Run' : 'Run'}
              </button>
            </div>
          </div>

          {/* 60-segment progress bar */}
          <div style={{ marginTop: 12, display: 'flex', gap: 2, height: 18 }}>
            {Array.from({ length: 60 }).map((_, i) => {
              const filled = i / 60 < simProgress
              const isHot  = isRunning && i === Math.floor(simProgress * 60)
              return (
                <div key={i} style={{
                  flex: 1,
                  background: isHot ? T.amber : filled ? T.amber : T.rule,
                  opacity: isHot ? 1 : filled ? 0.3 + (i / 60) * 0.7 : 1,
                }} />
              )
            })}
          </div>

          <div className="pw-mono" style={{ marginTop: 8, fontSize: 9, color: T.dim }}>
            <span style={{ color: T.amber }}>▸</span> next race · {nextRace ? nextRace.name : 'Season complete'}
            {nextRace?.pred && (
              <> · predicted winner <span style={{ color: T.amber, fontWeight: 700 }}>{nextRace.pred}</span> · conf {Math.round((nextRace.conf ?? 0) * 100)}%</>
            )}
          </div>
        </div>

        {/* Channels */}
        <div style={{ padding: '12px 18px', borderLeft: `1px solid ${T.rule}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Label style={{ color: T.faint }}>channels</Label>
          {[
            ['DRIVERS',   '20',    T.text],
            ['CIRCUITS',  String(races.length), T.text],
            ['SIMULATED', `${cutoff}→${totalRounds}`, T.amber],
            ['DNFs/RUN',  '1.2',   T.amber],
            ['SC EVENTS', '0.7',   T.amber],
          ].map(([k, v, c]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, alignItems: 'baseline' }}>
              <span style={{ color: T.dim, letterSpacing: '0.07em' }}>{k}</span>
              <span className="pw-mono" style={{ color: c, fontSize: 11 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN 3-COL GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 280px', flex: 1, minHeight: 0 }}>

        {/* LEFT — Parameters */}
        <div style={{
          borderRight: `1px solid ${T.rule}`, padding: '4px 14px 12px',
          display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto',
        }}>
          <Label style={{ color: T.faint }}>parameters</Label>

          {/* MC runs slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: T.dim }}>MONTE CARLO RUNS</span>
              <span className="pw-mono" style={{ fontSize: 14, fontWeight: 700, color: T.amber }}>{nSims.toLocaleString()}</span>
            </div>
            <input
              type="range" min={1000} max={50000} step={1000}
              value={nSims} onChange={e => setNSims(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: T.amber }}
            />
            <div className="pw-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: T.faint, marginTop: 4 }}>
              <span>1K</span><span>10K</span><span>25K</span><span>50K</span>
            </div>
          </div>

          {/* Chaos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: T.dim }}>CHAOS FACTOR</span>
              <span className="pw-mono" style={{ fontSize: 14, fontWeight: 700, color: T.amber }}>{chaos.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0.05} max={0.50} step={0.01}
              value={chaos} onChange={e => setChaos(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: T.amber }}
            />
            <div className="pw-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: T.faint, marginTop: 4 }}>
              <span>0.05</span><span>0.15</span><span>0.30</span><span>0.50</span>
            </div>
          </div>

          {/* ── DATA RANGE ── */}
          <div style={{ borderTop: `1px solid ${T.rule}`, paddingTop: 12 }}>
            <Label style={{ color: T.amber, marginBottom: 8 }}>data range</Label>

            {/* Dual-handle year range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Decrease start */}
              <button
                onClick={() => setDataRangeStart(s => Math.max(2018, s - 1))}
                disabled={dataRangeStart <= 2018}
                style={{
                  background: 'transparent', border: `1px solid ${T.rule}`, color: T.dim,
                  width: 20, height: 20, cursor: dataRangeStart <= 2018 ? 'not-allowed' : 'pointer',
                  fontSize: 10, opacity: dataRangeStart <= 2018 ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >←</button>

              {/* Start year */}
              <div style={{
                background: T.amberDim, border: `1px solid ${T.amber}`,
                padding: '3px 7px', fontSize: 11, fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace', color: T.amber, flexShrink: 0,
              }}>
                {dataRangeStart}
              </div>

              {/* Range bar */}
              <div style={{ flex: 1, height: 2, background: T.amber, opacity: 0.4, position: 'relative' }}>
                <div style={{
                  position: 'absolute', top: -3, left: 0, right: 0,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  {Array.from({ length: dataRangeEnd - dataRangeStart - 1 }).map((_, i) => (
                    <div key={i} style={{ width: 2, height: 8, background: T.amber, opacity: 0.3, marginTop: -3 }} />
                  ))}
                </div>
              </div>

              {/* End year */}
              <div style={{
                background: T.amberDim, border: `1px solid ${T.amber}`,
                padding: '3px 7px', fontSize: 11, fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace', color: T.amber, flexShrink: 0,
              }}>
                {dataRangeEnd}
              </div>

              {/* Increase end */}
              <button
                onClick={() => setDataRangeEnd(e => Math.min(2026, e + 1))}
                disabled={dataRangeEnd >= 2026}
                style={{
                  background: 'transparent', border: `1px solid ${T.rule}`, color: T.dim,
                  width: 20, height: 20, cursor: dataRangeEnd >= 2026 ? 'not-allowed' : 'pointer',
                  fontSize: 10, opacity: dataRangeEnd >= 2026 ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >→</button>
            </div>

            {/* Also: decrease end / increase start buttons on second row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <button
                onClick={() => setDataRangeStart(s => Math.min(s + 1, dataRangeEnd))}
                disabled={dataRangeStart >= dataRangeEnd}
                style={{
                  background: 'transparent', border: `1px solid ${T.rule}`, color: T.faint,
                  padding: '2px 6px', fontSize: 8, letterSpacing: '0.08em',
                  cursor: dataRangeStart >= dataRangeEnd ? 'not-allowed' : 'pointer',
                  opacity: dataRangeStart >= dataRangeEnd ? 0.3 : 1,
                }}
              >START →</button>
              <span className="pw-mono" style={{ fontSize: 9, color: T.dim, alignSelf: 'center' }}>
                {dataRangeEnd - dataRangeStart + 1} season{dataRangeEnd - dataRangeStart !== 0 ? 's' : ''}
              </span>
              <button
                onClick={() => setDataRangeEnd(e => Math.max(e - 1, dataRangeStart))}
                disabled={dataRangeEnd <= dataRangeStart}
                style={{
                  background: 'transparent', border: `1px solid ${T.rule}`, color: T.faint,
                  padding: '2px 6px', fontSize: 8, letterSpacing: '0.08em',
                  cursor: dataRangeEnd <= dataRangeStart ? 'not-allowed' : 'pointer',
                  opacity: dataRangeEnd <= dataRangeStart ? 0.3 : 1,
                }}
              >← END</button>
            </div>

            {/* Recency weighting explanation */}
            <div className="pw-mono" style={{
              fontSize: 7.5, color: T.faint, marginTop: 7, lineHeight: 1.5, letterSpacing: '0.04em',
            }}>
              Ratings weighted by recency:
              {[dataRangeEnd, dataRangeEnd-1, dataRangeEnd-2].filter(y => y >= dataRangeStart).map(y => {
                const w = Math.max(0.3, 1.0 - 0.3 * (dataRangeEnd - y)).toFixed(1)
                return ` ${y} ×${w}`
              }).join(',')}
              {dataRangeEnd - dataRangeStart > 2 ? ', older ×0.3' : ''}
            </div>
          </div>

          {/* Weather */}
          <div>
            <span style={{ fontSize: 10, color: T.dim }}>WEATHER MODEL</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 7 }}>
              {([
                ['HISTORICAL', 'Historical Weather (uses real race data)'],
                ['DRY',        'All Dry Conditions'],
                ['RANDOM',     'Random Weather per Race'],
                ['MONSOON',    'Heavy Rain All Season'],
              ] as const).map(([k, tip]) => {
                const on = k === weather
                return (
                  <TooltipChip
                    key={k} label={k} tooltip={tip}
                    active={on} onClick={() => setWeather(k)}
                    style={{
                      ...chipBase,
                      padding: '5px 6px',
                      background: on ? T.amberDim : 'transparent',
                      border: `1px solid ${on ? T.amber : T.rule}`,
                      fontSize: 8, letterSpacing: '0.09em',
                      color: on ? T.amber : T.dim, textAlign: 'center',
                      width: '100%',
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Reliability */}
          <div>
            <span style={{ fontSize: 10, color: T.dim }}>RELIABILITY</span>
            <div style={{ display: 'flex', gap: 3, marginTop: 7 }}>
              {([
                ['HIST', 'Historical Reliability (real DNF rates)'],
                ['OPT',  'Optimistic (50% fewer DNFs)'],
                ['PES',  'Pessimistic (50% more DNFs)'],
              ] as const).map(([k, tip]) => {
                const on = k === reliability
                return (
                  <TooltipChip
                    key={k} label={k} tooltip={tip}
                    active={on} onClick={() => setReliability(k)}
                    containerStyle={{ flex: 1 }}
                    style={{
                      ...chipBase,
                      padding: '5px 0',
                      background: on ? T.amberDim : 'transparent',
                      border: `1px solid ${on ? T.amber : T.rule}`,
                      fontSize: 8, letterSpacing: '0.09em',
                      color: on ? T.amber : T.dim, textAlign: 'center',
                      width: '100%',
                    }}
                  />
                )
              })}
            </div>
          </div>

          <div style={{ height: 1, background: T.rule }} />

          {/* Season context */}
          <div>
            <Label style={{ color: T.faint, marginBottom: 7 }}>context · {season}</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
              {[
                ['rounds in season', String(meta.rounds)],
                ['cutoff round',     `R${cutoff}`],
                ['rounds simulated', String(totalRounds - cutoff)],
                ['data range',       `${dataRangeStart}–${dataRangeEnd}`],
                ['historical champion', meta.champion ?? '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: T.dim }}>{k}</span>
                  <span className="pw-mono" style={{
                    color: k === 'cutoff round' || k === 'data range' || k === 'historical champion' ? T.amber : T.text,
                    fontWeight: k === 'cutoff round' ? 700 : 400,
                  }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — Standings */}
        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <Label style={{ color: T.faint }}>championship projection · from R{String(cutoff).padStart(2,'0')} forward</Label>
              {isRunning && <span className="pw-mono" style={{ fontSize: 8, color: T.amber }}>● updating</span>}
              {results.length > 0 && !isRunning && <span className="pw-mono" style={{ fontSize: 8, color: T.ok }}>● live data</span>}
            </div>
            <span className="pw-mono" style={{ fontSize: 8, color: T.dim }}>
              σ ±{standingsRows[0]?.std ?? 24} PTS
            </span>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '20px 22px 1fr 80px 52px 64px 50px',
            gap: 10, padding: '4px 0', fontSize: 8, letterSpacing: '0.14em',
            color: T.faint, borderBottom: `1px solid ${T.rule}`,
            textTransform: 'uppercase', fontWeight: 600,
          }}>
            <span>P</span><span></span><span>DRIVER</span>
            <span>WDC %</span><span>EXP PTS</span><span>TREND</span><span style={{ textAlign: 'right' }}>DNF</span>
          </div>

          {/* Rows */}
          <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
            {isRunning && results.length === 0
              ? Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '20px 22px 1fr 80px 52px 64px 50px',
                    gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.rule}`,
                    alignItems: 'center',
                    animation: `pw-pulse 1.4s ease-in-out ${(i * 0.05).toFixed(2)}s infinite`,
                  }}>
                    <div style={{ height: 10, width: 16, background: T.rule, borderRadius: 2 }} />
                    <div style={{ width: 7, height: 7, background: T.rule }} />
                    <div>
                      <div style={{ height: 10, width: `${60 + (i % 5) * 15}px`, background: T.rule, borderRadius: 2 }} />
                      <div style={{ height: 7, width: 80, background: T.rule, borderRadius: 2, marginTop: 4 }} />
                    </div>
                    <div style={{ height: 10, width: 40, background: T.rule, borderRadius: 2 }} />
                    <div style={{ height: 10, width: 30, background: T.rule, borderRadius: 2 }} />
                    <div style={{ height: 12, width: 60, background: T.rule, borderRadius: 2 }} />
                    <div style={{ height: 9, width: 20, background: T.rule, borderRadius: 2 }} />
                  </div>
                ))
              : standingsRows.map((row, i) => {
              const d = driverInfo(row.id)
              const tc = driverTeamColor(row.id)
              const isTop = i === 0
              const spark = MOCK_SPARKS[row.id] ?? (results.length > 0 ? genSpark(row.wdc, row.std, i) : [])
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 22px 1fr 80px 52px 64px 50px',
                    gap: 10, padding: '8px 0', alignItems: 'center',
                    borderBottom: `1px solid ${T.rule}`,
                    background: isTop ? T.amberDim : 'transparent',
                    marginLeft: isTop ? -18 : 0, marginRight: isTop ? -18 : 0,
                    paddingLeft: isTop ? 18 : 0, paddingRight: isTop ? 18 : 0,
                    position: 'relative',
                  }}
                >
                  {isTop && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: T.amber }} />}
                  <span className="pw-mono" style={{ fontSize: 12, fontWeight: 700, color: isTop ? T.amber : T.dim, textAlign: 'right' }}>
                    {String(i + 1).padStart(2,'0')}
                  </span>
                  <Pip color={tc} size={7} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{d.name}</div>
                    <div className="pw-mono" style={{ fontSize: 8, color: T.faint, marginTop: 1, letterSpacing: '0.07em' }}>
                      {d.abbr} · {d.team.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="pw-mono" style={{ fontSize: 11, fontWeight: 700, color: isTop ? T.amber : T.text }}>
                      {(row.wdc * 100).toFixed(1)}%
                    </div>
                    <div style={{ height: 2, background: T.rule, marginTop: 2, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(row.wdc / 0.4) * 100}%`, background: isTop ? T.amber : tc }} />
                    </div>
                  </div>
                  <span className="pw-mono" style={{ fontSize: 10 }}>{row.pts}</span>
                  <Spark data={spark} color={isTop ? T.amber : tc} />
                  <span className="pw-mono" style={{ fontSize: 9, color: T.dim, textAlign: 'right' }}>
                    {(row.dnf * 100).toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — Actual vs Predicted + Next race + Constructors */}
        <div style={{ borderLeft: `1px solid ${T.rule}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Next race card */}
          <div style={{ background: T.sunk, border: `1px solid ${T.amber}`, padding: '10px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -1, left: -1, right: -1, height: 2, background: T.amber }} />
            <Label style={{ color: T.amber }}>next race · predicted winner</Label>
            {nextRace ? (() => {
              const wId = nextRace.pred || nextRace.winner || ''
              const wd  = driverInfo(wId)
              const wc  = driverTeamColor(wId)
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
                    <span className="pw-mono" style={{ fontSize: 9, color: T.faint }}>R{String(nextRace.r).padStart(2,'0')}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{nextRace.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Pip color={wc} size={9} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{wd.name}</div>
                      <div className="pw-mono" style={{ fontSize: 8, color: T.dim, marginTop: 2, letterSpacing: '0.07em' }}>
                        {wId} · {wd.team.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <div className="pw-mono" style={{ fontSize: 18, fontWeight: 700, color: T.amber, lineHeight: 1, textAlign: 'right' }}>
                        {Math.round((nextRace.conf ?? 0.55) * 100)}%
                      </div>
                      <div className="pw-mono" style={{ fontSize: 7, color: T.faint, letterSpacing: '0.12em', textAlign: 'right', marginTop: 1 }}>CONFIDENCE</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.rule}` }}>
                    <Label style={{ color: T.faint, marginBottom: 5 }}>podium mix</Label>
                    {standingsRows.slice(0, 3).map((row, i) => {
                      const pd = driverInfo(row.id)
                      const p = [0.62, 0.41, 0.28][i]
                      return (
                        <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '12px 1fr 32px', gap: 5, alignItems: 'center', padding: '2px 0' }}>
                          <span className="pw-mono" style={{ fontSize: 9, color: T.dim }}>P{i+1}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Pip color={driverTeamColor(row.id)} size={4} />
                            <span style={{ fontSize: 10 }}>{pd.name}</span>
                          </div>
                          <span className="pw-mono" style={{ fontSize: 9, color: T.amber, textAlign: 'right' }}>{Math.round(p * 100)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })() : (
              <div style={{ marginTop: 8, fontSize: 11, color: T.dim }}>
                Season complete. <span style={{ color: T.amber }}>{meta.champion}</span> wins the WDC.
              </div>
            )}
          </div>

          {/* Constructors */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <Label style={{ color: T.faint }}>constructors · wcc (projected)</Label>
              {constructors.length === 0 && <span className="pw-mono" style={{ fontSize: 7, color: T.faint }}>run to load</span>}
            </div>
            {(constructors.length > 0
              ? constructors.slice(0, 10)
              : [
                  { team_name: 'McLaren',     wcc_probability: 0.612, expected_points: 756 },
                  { team_name: 'Red Bull',    wcc_probability: 0.214, expected_points: 622 },
                  { team_name: 'Ferrari',     wcc_probability: 0.118, expected_points: 553 },
                  { team_name: 'Mercedes',    wcc_probability: 0.042, expected_points: 487 },
                  { team_name: 'Williams',    wcc_probability: 0.013, expected_points: 212 },
                ] as ConstructorResult[]
            ).map((c, i) => (
              <div key={c.team_name} style={{
                display: 'grid', gridTemplateColumns: '9px 1fr 40px 44px', gap: 7,
                alignItems: 'center', padding: '4px 0',
                borderBottom: i < (constructors.length > 0 ? constructors.length - 1 : 4) ? `1px solid ${T.rule}` : 'none',
              }}>
                <Pip color={teamColorFor(c.team_name)} size={7} />
                <span style={{ fontSize: 10 }}>{c.team_name}</span>
                <span className="pw-mono" style={{ fontSize: 10, color: i === 0 ? T.amber : T.text, textAlign: 'right', fontWeight: 600 }}>
                  {(c.wcc_probability * 100).toFixed(1)}%
                </span>
                <span className="pw-mono" style={{ fontSize: 9, color: T.dim, textAlign: 'right' }}>{Math.round(c.expected_points)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        height: 26, borderTop: `1px solid ${T.rule}`,
        display: 'flex', alignItems: 'center', flexShrink: 0,
        fontSize: 9, color: T.faint, fontFamily: 'JetBrains Mono, monospace',
      }}>
        <div style={{ padding: '0 12px', borderRight: `1px solid ${T.rule}`, color: isRunning ? T.amber : T.ok }}>
          {isRunning ? '● SIMULATING' : results.length > 0 ? '● DONE' : '● READY'}
        </div>
        <div style={{ padding: '0 12px', borderRight: `1px solid ${T.rule}` }}>
          SEASON {season} · R{String(cutoff).padStart(2,'0')} · {isRunning ? 'SIMULATING' : results.length > 0 ? 'SNAPSHOT' : 'IDLE'}
        </div>
        <div style={{ padding: '0 12px', borderRight: `1px solid ${T.rule}` }}>
          {cutoffRace?.name || '—'}
        </div>
        <div style={{ padding: '0 12px', borderRight: `1px solid ${T.rule}` }}>
          DATA {dataRangeStart}–{dataRangeEnd}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 12px', borderLeft: `1px solid ${T.rule}`, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 1 }}>
          <span style={{ fontSize: 7, color: T.amber, letterSpacing: '0.08em' }}>{dateDisplay}</span>
          <span style={{ color: T.amber }}>{timeDisplay} IST</span>
        </div>
        <div style={{ padding: '0 12px', borderLeft: `1px solid ${T.rule}` }}>
          <span style={{ color: T.ok }}>●</span> backend · pitwall
        </div>
        <div style={{ padding: '0 12px', borderLeft: `1px solid ${T.rule}` }}>
          build 0847.3fe1
        </div>
      </div>

    </div>
  )
}
