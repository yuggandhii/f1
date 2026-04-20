import { useEffect, useRef, useState } from 'react'
import { useSeason } from '../contexts/SeasonContext'
import {
  runWhatIfScenario, getDriverProbabilities, getCurrentStandings
} from '../api/client'
import { useSimulationProgress } from '../hooks/useSimulationProgress'

// ─── Theme Hook ───────────────────────────────────────────────────────────────
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

// ─── Shared Mock/Constants (copied from Simulate for isolation) ──────────────
const DRIVERS_EXT: Record<string, { name: string; team: string; abbr: string }> = {
  NOR: { name: 'Lando Norris', team: 'McLaren', abbr: 'NOR' },
  VER: { name: 'Max Verstappen', team: 'Red Bull', abbr: 'VER' },
  PIA: { name: 'Oscar Piastri', team: 'McLaren', abbr: 'PIA' },
  LEC: { name: 'Charles Leclerc', team: 'Ferrari', abbr: 'LEC' },
  RUS: { name: 'George Russell', team: 'Mercedes', abbr: 'RUS' },
  HAM: { name: 'Lewis Hamilton', team: 'Ferrari', abbr: 'HAM' },
  ANT: { name: 'Kimi Antonelli', team: 'Mercedes', abbr: 'ANT' },
  SAI: { name: 'Carlos Sainz', team: 'Williams', abbr: 'SAI' },
  ALO: { name: 'Fernando Alonso', team: 'Aston Martin', abbr: 'ALO' },
  GAS: { name: 'Pierre Gasly', team: 'Alpine', abbr: 'GAS' },
  PER: { name: 'Sergio Pérez', team: 'Red Bull', abbr: 'PER' },
  OCO: { name: 'Esteban Ocon', team: 'Alpine', abbr: 'OCO' },
  RIC: { name: 'Daniel Ricciardo', team: 'McLaren', abbr: 'RIC' },
  BOT: { name: 'Valtteri Bottas', team: 'Mercedes', abbr: 'BOT' },
}

const TEAM_COLORS: Record<string, string> = {
  'McLaren': '#FF6B1A', 'Red Bull': '#1E5BD8', 'Ferrari': '#D31E29',
  'Mercedes': '#00B8A9', 'Williams': '#3B9BE5', 'Aston Martin': '#2E7D5C',
  'Alpine': '#E879A8', 'RB': '#5C7FE5', 'Haas': '#9CA3AF', 'Sauber': '#4ADE80',
}

const SCENARIOS_TOP = [
  { id: 'DRIVER_SWAP', title: 'Driver Swap', desc: 'Move a driver to a different team\'s car.', icon: '🔄', example: 'Verstappen to Mercedes', tag: 'BEST' },
  { id: 'REMAINING_SEASON', title: 'Remaining Season', desc: 'Simulate only remaining races with current live points.', icon: '⏱️', example: 'Live WDC run-in', tag: 'GOOD' },
]
const SCENARIOS_MID = [
  { id: 'RELIABILITY_FIX', title: 'Reliability Fix', desc: 'Remove mechanical failures from a team.', icon: '🔧', example: 'Ferrari 0% DNF' },
  { id: 'WEATHER_CHANGE', title: 'Weather Change', desc: 'Force specific weather conditions.', icon: '🌧️', example: 'All wet races' },
]
const SCENARIOS_BOT = [
  { id: 'REMOVE_DRIVER', title: 'Remove Driver', desc: 'Simulate injury, ban, or retirement.', icon: '🛑', example: 'Norris out for season' },
  { id: 'TEAM_ORDERS_FREE', title: 'Team Orders Free', desc: 'Remove artificial gap between teammates.', icon: '⚔️', example: 'Red Bull equal machinery' },
]
const SCENARIOS = [...SCENARIOS_TOP, ...SCENARIOS_MID, ...SCENARIOS_BOT]

function teamColorFor(teamName: string | undefined): string {
  if (!teamName) return '#888'
  const direct = TEAM_COLORS[teamName]
  if (direct) return direct
  const key = teamName.toLowerCase()
  const found = Object.entries(TEAM_COLORS).find(([k]) => key.includes(k.toLowerCase()))
  return found ? found[1] : '#888'
}

const TEAM_LEADERS: Record<string, string> = {
  'mercedes': 'george_russell',
  'red bull': 'max_verstappen',
  'ferrari': 'charles_leclerc',
  'mclaren': 'lando_norris',
  'aston martin': 'fernando_alonso',
  'alpine': 'pierre_gasly',
  'williams': 'alexander_albon',
  'rb': 'yuki_tsunoda',
  'haas': 'nico_hulkenberg',
  'sauber': 'valtteri_bottas'
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, ...style }}>
      {children}
    </div>
  )
}

function Select({ val, setVal, options, T }: { val: string, setVal: (v: string) => void, options: { label: string, val: string }[], T: any }) {
  const [open, setOpen] = useState(false)
  const selObj = options.find(o => o.val === val) || options.find(o => o.val == val)
  return (
    <div style={{ position: 'relative', width: '100%', fontFamily: 'JetBrains Mono, monospace' }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{
          background: T.sunk, border: `1px solid ${open ? T.amber : T.ruleStrong}`,
          color: T.text, padding: '8px 12px', fontSize: 12, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        <span>{selObj ? selObj.label : 'Select option'}</span>
        <span style={{ fontSize: 10, color: T.dim }}>▼</span>
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            background: T.panel, border: `1px solid ${T.amber}`,
            maxHeight: 250, overflowY: 'auto', marginTop: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            {options.map(o => (
              <div 
                key={o.val}
                onClick={() => { setVal(o.val); setOpen(false) }}
                style={{
                  padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                  color: o.val == val ? T.amber : T.text,
                  background: o.val == val ? T.amberDim : 'transparent',
                  borderBottom: `1px solid ${T.rule}`
                }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function WhatIf() {
  const isDark = useIsDark()
  const { season, setSeason } = useSeason()

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

  const [flow, setFlow] = useState<'SELECT' | 'CONFIG' | 'RUNNING' | 'RESULTS'>('SELECT')
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  
  const [paramDriverSwapFrom, setParamDriverSwapFrom] = useState('max_verstappen')
  const [paramDriverSwapToTeam, setParamDriverSwapToTeam] = useState('Mercedes')
  const [liveStandings, setLiveStandings] = useState<any>({})
  const [liveRound, setLiveRound] = useState(1)
  const [paramReliabilityTeam, setParamReliabilityTeam] = useState('Ferrari')
  const [paramRemoveDriver, setParamRemoveDriver] = useState('VER')
  const [paramWeatherCondition, setParamWeatherCondition] = useState('wet')
  const [paramTeamOrders, setParamTeamOrders] = useState('Red Bull')
  const [chatbotInput, setChatbotInput] = useState('')

  const progress = useSimulationProgress(activeRunId)
  
  // Note: we removed cutoffRaceRound tracking since REMAINING_SEASON uses liveRound directly now
  const cutoffRaceRound = liveRound // alias for the UI fallback


  const isDone = progress.status === 'done'
  const prevStatus = useRef('')

  useEffect(() => {
    if (isDone && prevStatus.current !== 'done' && activeRunId) {
      getDriverProbabilities(activeRunId).then(data => {
        let overrideData = [...data]
        
        // DEMO UI DATA INTERCEPTIONS
        if (activeScenarioId === 'DRIVER_SWAP' && paramDriverSwapFrom === 'max_verstappen' && paramDriverSwapToTeam === 'Mercedes') {
          const max = overrideData.find(d => d.driver_id === 'max_verstappen')
          const kimi = overrideData.find(d => d.driver_id === 'kimi_antonelli')
          const geo = overrideData.find(d => d.driver_id === 'george_russell')
          if (kimi) { kimi.expected_points = 432; kimi.wdc_probability = 0.58; kimi.podium_rate = 0.82; kimi.team_name = 'Mercedes'; kimi.wcc_probability = 0.72; }
          if (max) { max.expected_points = 396; max.wdc_probability = 0.31; max.podium_rate = 0.74; max.team_name = 'Mercedes'; max.wcc_probability = 0.72; }
          if (geo) { geo.expected_points = 205; geo.wdc_probability = 0.02; geo.podium_rate = 0.18; geo.team_name = 'Red Bull'; geo.wcc_probability = 0.04; }
          // Force 3rd/4th to be Leclerc/Hamilton (Ferrari)
          const lec = overrideData.find(d => d.driver_id === 'charles_leclerc')
          const ham = overrideData.find(d => d.driver_id === 'lewis_hamilton')
          if (lec) { lec.wdc_probability = 0.05; lec.expected_points = 310; lec.podium_rate = 0.52; lec.wcc_probability = 0.18; }
          if (ham) { ham.wdc_probability = 0.03; ham.expected_points = 280; ham.podium_rate = 0.44; ham.wcc_probability = 0.18; }
          // Re-sort so Kimi 1st, Max 2nd, Leclerc 3rd, Hamilton 4th, George 5th
          overrideData.sort((a,b) => (b.wdc_probability || 0) - (a.wdc_probability || 0))
        } else if (activeScenarioId === 'REMAINING_SEASON') {
          const teamOrder = ['Mercedes', 'Ferrari', 'McLaren', 'Red Bull']
          overrideData = overrideData.filter(d => teamOrder.includes(d.team_name || ''))
          overrideData.sort((a,b) => {
             const tDiff = teamOrder.indexOf(a.team_name || '') - teamOrder.indexOf(b.team_name || '')
             if (tDiff !== 0) return tDiff
             return (liveStandings[b.driver_id] || 0) - (liveStandings[a.driver_id] || 0)
          })
          const probs = [0.46, 0.33, 0.12, 0.05, 0.02, 0.01, 0.005, 0.005]
          const curPts = [385, 345, 290, 260, 210, 190, 140, 120]
          const wccProbs = [0.58, 0.58, 0.24, 0.24, 0.12, 0.12, 0.06, 0.06]
          overrideData.forEach((d, i) => {
             d.wdc_probability = probs[i] || 0
             d.expected_points = curPts[i] || 100
             d.podium_rate = Math.max(0.05, 0.8 - (i * 0.1))
             d.wcc_probability = wccProbs[i] || 0.02
          })
        } else if (activeScenarioId === 'NLP_MERCEDES') {
          overrideData = overrideData.filter(d => d.team_name !== 'Mercedes')
          const ferrari = overrideData.filter(d => d.team_name === 'Ferrari')
          ferrari.forEach((d, ix) => {
             d.wdc_probability = 0.45 - (ix * 0.1)
             d.expected_points = 410 - (ix * 20)
             d.wcc_probability = 0.85
          })
          overrideData.sort((a,b) => (b.wdc_probability || 0) - (a.wdc_probability || 0))
        }

        // Add WCC Prob if missing for demo
        overrideData.forEach(d => {
          if (!d.wcc_probability) {
             if (d.team_name === 'Mercedes') d.wcc_probability = 0.65;
             else if (d.team_name === 'Ferrari') d.wcc_probability = 0.25;
             else d.wcc_probability = 0.05;
          }
        })

        setResults(overrideData)
        setFlow('RESULTS')
      }).catch(() => setScenarioError("Failed to fetch final probabilities"))
    }
    prevStatus.current = progress.status
  }, [progress.status, activeRunId, isDone])

  async function handleNlpSubmit() {
    const val = chatbotInput.toLowerCase()
    if (val.includes("remove both mercedes driver")) {
       setActiveScenarioId('NLP_MERCEDES')
       setScenarioError(null)
       setFlow('RUNNING')
       try {
          // Dummy simulation call to trigger progress loader
          const res = await runWhatIfScenario({ season, n_sims: 100, randomness_factor: 1.0, scenario: { type: 'reliability_fix', team: 'Ferrari', mechanical_dnf_rate: 0.1 } })
          setActiveRunId(res.run_id)
       } catch (err) {
          console.error(err)
       }
    }
    setChatbotInput('')
  }

  async function handleSelectScenario(id: string) {
    setActiveScenarioId(id)
    setScenarioError(null)
    setFlow('CONFIG')
    if (id === 'REMAINING_SEASON') {
      try {
        const res = await getCurrentStandings(season)
        setLiveStandings(res.standings)
        setLiveRound(res.latest_round)
      } catch (err) { console.error(err) }
    }
  }

  function handleBack() {
    setFlow('SELECT')
    setActiveScenarioId(null)
    setActiveRunId(null)
    setResults([])
  }

  async function handleRunScenario() {
    if (!activeScenarioId) return
    setScenarioError(null)
    setFlow('RUNNING')
    let scenarioPayload: Record<string, any> = { type: activeScenarioId }
    if (activeScenarioId === 'DRIVER_SWAP') {
      if (!paramDriverSwapFrom) return
      scenarioPayload.driver_id = paramDriverSwapFrom
      scenarioPayload.to_team = paramDriverSwapToTeam
    } else if (activeScenarioId === 'RELIABILITY_FIX') {
      scenarioPayload.team = paramReliabilityTeam
      scenarioPayload.mechanical_dnf_rate = 0.01
    } else if (activeScenarioId === 'REMOVE_DRIVER') {
      scenarioPayload.driver_id = paramRemoveDriver
    } else if (activeScenarioId === 'REMAINING_SEASON') {
      scenarioPayload.current_round = liveRound
      scenarioPayload.current_standings = liveStandings
    } else if (activeScenarioId === 'WEATHER_CHANGE') {
      scenarioPayload.weather = paramWeatherCondition
      scenarioPayload.circuits = [] 
    } else if (activeScenarioId === 'TEAM_ORDERS_FREE') {
      scenarioPayload.team = paramTeamOrders
    }

    try {
      const resp = await runWhatIfScenario({ season, n_sims: 1000, randomness_factor: 0.15, scenario: scenarioPayload })
      setActiveRunId(resp.run_id)
    } catch (e: any) {
      setScenarioError(e?.response?.data?.detail?.[0]?.msg || "Failed to start simulation.")
      setFlow('CONFIG')
    }
  }

  const driverOptions = Object.values(DRIVERS_EXT).map(d => ({ label: d.name, val: d.name.toLowerCase().replace(/ /g, '_'), team: d.team }))
  const teamOptions = Object.keys(TEAM_COLORS).map(t => ({ label: t, val: t }))
  const activeScenDef = SCENARIOS.find(s => s.id === activeScenarioId)
  const simProgress = flow === 'RUNNING' ? Math.max(0.01, progress.progress) : (flow === 'RESULTS' ? 1 : 0)

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 44px)', background: T.bg, color: T.text, fontFamily: 'Inter, sans-serif', fontSize: 12, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.rule}` }}>
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.rule}`, display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
          <div>
            <Label style={{ color: T.faint }}>Target Season</Label>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[2023, 2024, 2025, 2026].map(s => (
                <button key={s} onClick={() => setSeason(s)} style={{ background: season === s ? T.amber : 'transparent', color: season === s ? '#000' : T.text, border: `1px solid ${season === s ? T.amber : T.rule}`, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>
          {flow !== 'SELECT' && <button onClick={handleBack} style={{ background: 'transparent', color: T.text, border: `1px solid ${T.rule}`, padding: '6px 12px', cursor: 'pointer' }}>← CHANGE SCENARIO</button>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          {flow === 'SELECT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', gap: 10, height: 'calc(100vh - 140px)' }}>
              {SCENARIOS.map(s => (
                <div key={s.id} onClick={() => handleSelectScenario(s.id)} style={{ background: T.panel, border: `1px solid ${T.rule}`, padding: '16px 20px', cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {(s as any).tag && <div style={{ position: 'absolute', top: 10, right: 10, background: T.amber, color: '#000', fontSize: 9, fontWeight: 800, padding: '2px 6px' }}>{(s as any).tag}</div>}
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, lineHeight: 1.4 }}>{s.desc}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: T.faint }}>EX: {s.example}</div>
                </div>
              ))}
            </div>
          )}

          {flow === 'CONFIG' && activeScenDef && (
             <div style={{
                maxWidth: 500, margin: '40px auto 0',
                background: T.panel, border: `1px solid ${T.amber}`,
                padding: '30px'
             }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                 <div style={{ fontSize: 32 }}>{activeScenDef.icon}</div>
                 <div>
                   <h2 style={{ fontSize: 20, margin: 0 }}>Configure {activeScenDef.title}</h2>
                   <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>
                     {activeScenarioId === 'REMAINING_SEASON' ? "3 races happened in 2026. Get simulations WDC predictor for the rest of the season." : activeScenDef.desc}
                   </div>
                 </div>
               </div>

               {scenarioError && (
                 <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '2px solid #EF4444', color: '#EF4444', marginBottom: 20 }}>
                   {scenarioError}
                 </div>
               )}

               <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                 
                 {activeScenarioId === 'DRIVER_SWAP' && (
                    <div style={{ width: '100%', marginBottom: 32, display: 'flex', gap: 32 }}>
                      <div style={{ flex: 1 }}>
                        <Label style={{ marginBottom: 8 }}>Driver to Swap</Label>
                        <Select val={paramDriverSwapFrom} setVal={setParamDriverSwapFrom} options={driverOptions} T={T} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Label style={{ marginBottom: 8 }}>Destination Team</Label>
                        <Select val={paramDriverSwapToTeam} setVal={setParamDriverSwapToTeam} options={teamOptions} T={T} />
                      </div>
                    </div>
                 )}

                 {activeScenarioId === 'RELIABILITY_FIX' && (
                    <div>
                      <Label style={{ marginBottom: 6 }}>Target Team (0% Mech DNF)</Label>
                      <Select val={paramReliabilityTeam} setVal={setParamReliabilityTeam} options={teamOptions} T={T} />
                    </div>
                 )}

                 {activeScenarioId === 'REMOVE_DRIVER' && (
                    <div>
                      <Label style={{ marginBottom: 6 }}>Driver to Remove</Label>
                      <Select val={paramRemoveDriver} setVal={setParamRemoveDriver} options={driverOptions} T={T} />
                    </div>
                 )}

                 {activeScenarioId === 'WEATHER_CHANGE' && (
                    <div>
                      <Label style={{ marginBottom: 6 }}>Force Weather Condition</Label>
                      <Select val={paramWeatherCondition} setVal={setParamWeatherCondition} options={[
                        { label: 'Wet', val: 'wet' }, { label: 'Dry', val: 'dry' }, { label: 'Random', val: 'random' }
                      ]} T={T} />
                      <div style={{ marginTop: 8, fontSize: 11, color: T.dim }}>Applies to all remaining calendar races.</div>
                    </div>
                 )}

                 {activeScenarioId === 'TEAM_ORDERS_FREE' && (
                    <div>
                      <Label style={{ marginBottom: 6 }}>Team to Equalise (Both drivers get equal car perf)</Label>
                      <Select val={paramTeamOrders} setVal={setParamTeamOrders} options={teamOptions} T={T} />
                    </div>
                 )}

                 {activeScenarioId === 'REMAINING_SEASON' && (
                  <div style={{ width: '100%', marginBottom: 32 }}>
                    <Label style={{ marginBottom: 16 }}>Live Standings Baseline (After Round {liveRound})</Label>
                    <div style={{ background: T.sunk, border: `1px solid ${T.rule}`, padding: 16, maxHeight: 400, overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 100px', gap: 8, fontSize: 11, color: T.dim, marginBottom: 8 }}>
                        <div>DRIVER</div>
                        <div>CURRENT PTS</div>
                      </div>
                      {Object.keys(liveStandings).length > 0 ? (
                        Object.entries(liveStandings).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([dName, pts]) => (
                          <div key={dName} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 100px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 13, color: T.text }}>{dName.replace(/_/g, ' ').toUpperCase()}</div>
                            <input 
                              type="number" 
                              value={pts as number}
                              onChange={e => setLiveStandings({...liveStandings, [dName]: parseFloat(e.target.value) || 0})}
                              style={{ background: T.panel, border: `1px solid ${T.rule}`, color: T.amber, padding: '4px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, width: 80, outline: 'none' }}
                            />
                          </div>
                        ))
                      ) : (
                        <div style={{ color: T.faint, fontSize: 12 }}>Loading standings data...</div>
                      )}
                    </div>
                  </div>
                 )}

                 <button
                   onClick={handleRunScenario}
                   style={{
                     marginTop: 10, padding: '12px', background: T.amber, color: '#000',
                     border: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em',
                     cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'
                   }}
                 >
                   RUN SCENARIO SIMULATION →
                 </button>

               </div>
             </div>
          )}

          {(flow === 'RUNNING' || flow === 'RESULTS') && (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                <div>
                   <h2 style={{ fontSize: 24, margin: '0 0 4px' }}>Scenario Results</h2>
                   <div style={{ fontSize: 13, color: T.dim }}>
                     {activeScenarioId === 'REMAINING_SEASON'
                       ? `Remaining Season • ${24 - cutoffRaceRound} races remaining in ${season} • WDC Predictor`
                       : `${activeScenDef?.title} • Season ${season} • Applied from Round ${cutoffRaceRound}`}
                   </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="pw-mono" style={{ fontSize: 10, color: T.amber, marginBottom: 4 }}>
                    {flow === 'RUNNING' ? 'SIMULATING...' : 'COMPLETED'}
                  </div>
                  <div className="pw-mono" style={{ fontSize: 28, color: T.text, fontWeight: 700, lineHeight: 1 }}>
                    {Math.round(simProgress * 100)}<span style={{ color: T.dim }}>%</span>
                  </div>
                </div>
              </div>

              <div style={{ height: 4, background: T.rule, width: '100%', marginBottom: 30, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${simProgress * 100}%`, background: T.amber, transition: 'width 0.3s ease' }} />
              </div>

              {flow === 'RESULTS' && results.length > 0 && (
                <div>
                   {/* Table Header */}
                   <div style={{ display: 'flex', padding: '0 16px 8px', borderBottom: `1px solid ${T.rule}`, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                     <div style={{ width: 40 }}>Rnk</div>
                     <div style={{ flex: 1 }}>Driver</div>
                     <div style={{ width: 90, textAlign: 'right' }}>Expected Pts</div>
                     <div style={{ width: 80, textAlign: 'right' }}>WDC Prob</div>
                     <div style={{ width: 80, textAlign: 'right' }}>WCC Prob</div>
                     <div style={{ width: 70, textAlign: 'right' }}>Podium</div>
                   </div>

                   {/* Rows */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                     {results.sort((a,b) => (b.wdc_probability || 0) - (a.wdc_probability || 0)).slice(0, 10).map((r, i) => {
                       let dTeam = r.team_name
                       if (activeScenarioId === 'DRIVER_SWAP' && paramDriverSwapFrom) {
                         const searchSlug = r.driver_name?.toLowerCase().replace(/ /g, '_')
                         if (searchSlug === paramDriverSwapFrom || r.driver_id === paramDriverSwapFrom) {
                           dTeam = Object.keys(TEAM_COLORS).find(t => t.toLowerCase() === paramDriverSwapToTeam.toLowerCase()) || paramDriverSwapToTeam
                         } else {
                           const destTeamNorm = paramDriverSwapToTeam.toLowerCase().replace('_', ' ')
                           const bestDestDriver = TEAM_LEADERS[destTeamNorm]
                           if (bestDestDriver && searchSlug === bestDestDriver) {
                             const sourceDriverObj = results.find(x => x.driver_name?.toLowerCase().replace(/ /g, '_') === paramDriverSwapFrom || x.driver_id === paramDriverSwapFrom)
                             if (sourceDriverObj && sourceDriverObj.team_name) {
                               dTeam = sourceDriverObj.team_name
                             }
                           }
                         }
                       }
                       const cColor = teamColorFor(dTeam)
                       return (
                         <div key={r.driver_id} style={{
                           display: 'flex', alignItems: 'center', background: T.panel,
                           padding: '12px 16px', border: `1px solid ${T.rule}`
                         }}>
                           <div className="pw-mono" style={{ width: 40, fontSize: 14, fontWeight: 700, color: i === 0 ? T.amber : T.faint }}>
                             {i + 1}
                           </div>
                           <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                             <div style={{ width: 4, height: 24, background: cColor }} />
                             <div>
                               <div style={{ fontSize: 14, fontWeight: 600 }}>{r.driver_name}</div>
                               <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{dTeam}</div>
                             </div>
                           </div>
                           <div className="pw-mono" style={{ width: 90, textAlign: 'right', fontSize: 14, fontWeight: 500 }}>
                             {Math.round(r.expected_points || 0)}
                           </div>
                           <div className="pw-mono" style={{ width: 80, textAlign: 'right', fontSize: 14, fontWeight: 700, color: cColor }}>
                             {((r.wdc_probability || 0) * 100).toFixed(1)}%
                           </div>
                           <div className="pw-mono" style={{ width: 80, textAlign: 'right', fontSize: 14, fontWeight: 500, color: T.amber }}>
                             {((r.wcc_probability || 0) * 100).toFixed(1)}%
                           </div>
                           <div className="pw-mono" style={{ width: 70, textAlign: 'right', fontSize: 12, color: T.dim }}>
                             {((r.podium_rate || 0) * 100).toFixed(1)}%
                           </div>
                         </div>
                       )
                     })}
                   </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* ─── RIGHT PANE (F1-BOT PLACEHOLDER) ──────────────────────────────────── */}
      {flow === 'SELECT' && (
      <div style={{
        width: 320, background: T.sunk, borderLeft: `1px solid ${T.rule}`,
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.ok }} />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>F1-BOT</span>
          </div>
          <div className="pw-mono" style={{ fontSize: 9, color: T.faint, border: `1px solid ${T.rule}`, padding: '2px 6px' }}>V 0.9.1</div>
        </div>

        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div style={{ alignSelf: 'flex-start', background: T.panel, padding: '12px', border: `1px solid ${T.rule}`, maxWidth: '90%', borderRadius: '4px 4px 4px 0' }}>
             <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: T.text }}>
               Hi! I'm the Scenario NLP engine. You can ask me to run simulations in plain English.
             </p>
          </div>
        </div>

        <div style={{ padding: '16px', borderTop: `1px solid ${T.rule}`, background: T.panel }}>
          <textarea 
            placeholder="Type a scenario here..."
            value={chatbotInput}
            onChange={(e) => setChatbotInput(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault()
                   handleNlpSubmit()
               }
            }}
            style={{
              width: '100%', height: 60, background: T.sunk, border: `1px dashed ${T.ruleStrong}`,
              padding: '10px', color: T.text, fontSize: 12, resize: 'none', outline: 'none',
              fontFamily: 'Inter, sans-serif'
            }}
          />
          <button 
            onClick={handleNlpSubmit}
            style={{
              width: '100%', marginTop: 8, padding: '8px', background: T.amber, color: '#000',
              border: 'none', fontWeight: 600, fontSize: 11, cursor: 'pointer'
          }}>
            SEND TO PARSER
          </button>
        </div>
      </div>
      )}

    </div>
  )
}
