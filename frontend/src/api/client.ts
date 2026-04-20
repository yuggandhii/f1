import axios from 'axios'

export const api = axios.create({ baseURL: '/api/v1' })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimulationRun {
  run_id: string
  season: number
  n_simulations: number
  randomness_factor: number
  status: 'pending' | 'running' | 'done' | 'failed'
  started_at: string | null
  completed_at: string | null
  result_path?: string | null
}

export interface DriverResult {
  driver_id: string
  driver_name?: string
  driver_abbreviation?: string
  team_name?: string
  team_constructor?: string
  wdc_probability: number
  expected_points: number
  points_std: number
  podium_rate: number
  dnf_rate_simulated: number
}

export interface Driver {
  id: string
  name: string
  abbreviation: string
  team_id: string | null
  nationality: string
  active?: boolean
}

export interface StandingsDriver {
  driver_id: string
  driver_name: string
  constructor: string
  points: number
  latest_round: number
}

export interface StandingsResponse {
  season: number
  latest_round: number
  standings: Record<string, number>
  drivers: StandingsDriver[]
}

export interface ScenarioParsed {
  prompt: string
  season: number
  parsed_scenario: Record<string, unknown>
  description: string
  valid: boolean
  validation_errors: string[]
}

export interface ComparisonDriver {
  driver: string
  base_wdc_prob: number
  scenario_wdc_prob: number
  delta: number
}

export interface ComparisonResult {
  base_run_id: string
  scenario_run_id: string
  drivers: ComparisonDriver[]
}

export interface DriverRaceHistory {
  id: string
  season: number
  round: number
  circuit_id: string
  grid_position: number | null
  finish_position: number | null
  points: number
  dnf: boolean
  weather: string | null
}

export interface DriverRating {
  season: number
  base_pace: number
  consistency: number
  wet_skill: number
  tyre_management: number
  overtake_skill: number
  qualifying_pace: number
  mechanical_dnf_rate: number
  teammate_index: number | null
}

// ─── Simulations ─────────────────────────────────────────────────────────────

export async function listSimulations(season?: number, limit = 20): Promise<SimulationRun[]> {
  const params: Record<string, unknown> = { limit }
  if (season) params.season = season
  const { data } = await api.get('/simulations/', { params })
  return data
}

export async function getSimulation(runId: string): Promise<SimulationRun> {
  const { data } = await api.get(`/simulations/${runId}`)
  return data
}

export async function runSimulation(params: {
  season: number
  n_sims: number
  randomness_factor: number
  scenario?: Record<string, unknown> | null
  data_range_start?: number | null
  data_range_end?: number | null
  cutoff_round?: number | null
}): Promise<{ run_id: string; status: string }> {
  const { data } = await api.post('/simulations/', {
    season: params.season,
    n_sims: params.n_sims,
    randomness_factor: params.randomness_factor,
    scenario: params.scenario ?? null,
    data_range_start: params.data_range_start ?? null,
    data_range_end: params.data_range_end ?? null,
    cutoff_round: params.cutoff_round ?? null,
  })
  return data
}

export async function getDriverProbabilities(runId: string): Promise<DriverResult[]> {
  const { data } = await api.get(`/simulations/${runId}/driver-probabilities`)
  return data
}

export interface ConstructorResult {
  team_name: string
  constructor: string
  expected_points: number
  wcc_probability: number
}

export async function getConstructorProbabilities(runId: string): Promise<ConstructorResult[]> {
  const { data } = await api.get(`/simulations/${runId}/constructor-probabilities`)
  return data
}

// ─── Circuits ────────────────────────────────────────────────────────────────

export interface CalendarRace {
  round: number
  name: string
  short: string
  country: string
  date: string
}

export async function getSeasonCalendar(season: number): Promise<CalendarRace[]> {
  const { data } = await api.get('/circuits/calendar', { params: { season } })
  return data
}

export interface ActualRaceResult {
  round: number
  circuit_name: string
  date: string
  winner_name: string | null
  winner_abbr: string | null
  winner_team: string | null
  p2_abbr: string | null
  p3_abbr: string | null
}

export interface RaceResultEntry {
  position: number
  driver_name: string
  abbreviation: string
  team: string | null
  points: number
}

export interface RaceResultData {
  has_result: boolean
  round: number
  season: number
  source?: string
  circuit_name?: string
  results: RaceResultEntry[]
}

export async function getRaceResult(season: number, round: number): Promise<RaceResultData> {
  const { data } = await api.get('/circuits/race-result', { params: { season, round } })
  return data
}

export async function getSeasonActualResults(season: number): Promise<ActualRaceResult[]> {
  try {
    const { data } = await api.get('/circuits/actual-results', { params: { season } })
    return data
  } catch {
    return []
  }
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export async function listDrivers(): Promise<Driver[]> {
  const { data } = await api.get('/drivers/')
  return data
}

export async function getDriver(driverId: string): Promise<Driver> {
  const { data } = await api.get(`/drivers/${driverId}`)
  return data
}

export async function getDriverHistory(driverId: string): Promise<DriverRaceHistory[]> {
  const { data } = await api.get(`/drivers/${driverId}/history`)
  return data
}

export async function getDriverRatings(driverId: string, season: number): Promise<DriverRating | null> {
  try {
    const { data } = await api.get(`/drivers/${driverId}/ratings`, { params: { season } })
    return data
  } catch {
    return null
  }
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

export async function getCurrentStandings(season: number): Promise<StandingsResponse> {
  const { data } = await api.get('/scenarios/current-standings', { params: { season } })
  return data
}

export async function parseNLPScenario(prompt: string, season: number): Promise<ScenarioParsed> {
  const { data } = await api.post('/scenarios/parse-nlp', { prompt, season })
  return data
}

export async function runWhatIfScenario(params: {
  season: number
  n_sims: number
  randomness_factor: number
  scenario: Record<string, unknown>
  base_run_id?: string
}): Promise<{ run_id: string; status: string; description: string }> {
  const { data } = await api.post('/scenarios/what-if', params)
  return data
}

export async function compareScenarios(baseRunId: string, scenarioRunId: string): Promise<ComparisonResult> {
  const { data } = await api.get('/scenarios/compare', {
    params: { base_run_id: baseRunId, scenario_run_id: scenarioRunId },
  })
  return data
}

export async function getTeammateComparison(season: number) {
  const { data } = await api.get('/analytics/teammate-comparison', { params: { season } })
  return data
}
