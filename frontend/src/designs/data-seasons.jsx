// Multi-season race data for the Pit Wall simulator.
// Winners + schedule are enough to drive realistic "simulate through race N" UX.

const SEASONS_META = {
  2021: { rounds: 22, champion: 'VER', runnerUp: 'HAM' },
  2023: { rounds: 22, champion: 'VER', runnerUp: 'PER' },
  2024: { rounds: 24, champion: 'VER', runnerUp: 'NOR' },
  2025: { rounds: 24, champion: 'NOR', runnerUp: 'PIA' },
  2026: { rounds: 24, champion: null, runnerUp: null }, // live
};

// Compact per-season race list. `winner` omitted for future rounds.
// Only the 2026 season has `done` status mid-year (round 13+ unraced).
const SEASON_RACES = {
  2021: [
    { r: 1,  name: 'Bahrain',        short: 'BHR', winner: 'HAM' },
    { r: 2,  name: 'Emilia-Romagna', short: 'IMO', winner: 'VER' },
    { r: 3,  name: 'Portugal',       short: 'POR', winner: 'HAM' },
    { r: 4,  name: 'Spain',          short: 'ESP', winner: 'HAM' },
    { r: 5,  name: 'Monaco',         short: 'MON', winner: 'VER' },
    { r: 6,  name: 'Azerbaijan',     short: 'AZE', winner: 'PER' },
    { r: 7,  name: 'France',         short: 'FRA', winner: 'VER' },
    { r: 8,  name: 'Styria',         short: 'STY', winner: 'VER' },
    { r: 9,  name: 'Austria',        short: 'AUT', winner: 'VER' },
    { r: 10, name: 'Britain',        short: 'GBR', winner: 'HAM' },
    { r: 11, name: 'Hungary',        short: 'HUN', winner: 'OCO' },
    { r: 12, name: 'Belgium',        short: 'BEL', winner: 'VER' },
    { r: 13, name: 'Netherlands',    short: 'NED', winner: 'VER' },
    { r: 14, name: 'Italy',          short: 'ITA', winner: 'RIC' },
    { r: 15, name: 'Russia',         short: 'RUS', winner: 'HAM' },
    { r: 16, name: 'Turkey',         short: 'TUR', winner: 'BOT' },
    { r: 17, name: 'Austin',         short: 'USA', winner: 'VER' },
    { r: 18, name: 'Mexico',         short: 'MEX', winner: 'VER' },
    { r: 19, name: 'São Paulo',      short: 'BRA', winner: 'HAM' },
    { r: 20, name: 'Qatar',          short: 'QAT', winner: 'HAM' },
    { r: 21, name: 'Saudi Arabia',   short: 'SAU', winner: 'HAM' },
    { r: 22, name: 'Abu Dhabi',      short: 'ABU', winner: 'VER' },
  ],
  2023: [
    { r: 1,  name: 'Bahrain',        short: 'BHR', winner: 'VER' },
    { r: 2,  name: 'Saudi Arabia',   short: 'SAU', winner: 'PER' },
    { r: 3,  name: 'Australia',      short: 'AUS', winner: 'VER' },
    { r: 4,  name: 'Azerbaijan',     short: 'AZE', winner: 'PER' },
    { r: 5,  name: 'Miami',          short: 'MIA', winner: 'VER' },
    { r: 6,  name: 'Monaco',         short: 'MON', winner: 'VER' },
    { r: 7,  name: 'Spain',          short: 'ESP', winner: 'VER' },
    { r: 8,  name: 'Canada',         short: 'CAN', winner: 'VER' },
    { r: 9,  name: 'Austria',        short: 'AUT', winner: 'VER' },
    { r: 10, name: 'Britain',        short: 'GBR', winner: 'VER' },
    { r: 11, name: 'Hungary',        short: 'HUN', winner: 'VER' },
    { r: 12, name: 'Belgium',        short: 'BEL', winner: 'VER' },
    { r: 13, name: 'Netherlands',    short: 'NED', winner: 'VER' },
    { r: 14, name: 'Italy',          short: 'ITA', winner: 'VER' },
    { r: 15, name: 'Singapore',      short: 'SGP', winner: 'SAI' },
    { r: 16, name: 'Japan',          short: 'JPN', winner: 'VER' },
    { r: 17, name: 'Qatar',          short: 'QAT', winner: 'VER' },
    { r: 18, name: 'Austin',         short: 'USA', winner: 'VER' },
    { r: 19, name: 'Mexico',         short: 'MEX', winner: 'VER' },
    { r: 20, name: 'São Paulo',      short: 'BRA', winner: 'VER' },
    { r: 21, name: 'Las Vegas',      short: 'LAS', winner: 'VER' },
    { r: 22, name: 'Abu Dhabi',      short: 'ABU', winner: 'VER' },
  ],
  2024: [
    { r: 1,  name: 'Bahrain',        short: 'BHR', winner: 'VER' },
    { r: 2,  name: 'Saudi Arabia',   short: 'SAU', winner: 'VER' },
    { r: 3,  name: 'Australia',      short: 'AUS', winner: 'SAI' },
    { r: 4,  name: 'Japan',          short: 'JPN', winner: 'VER' },
    { r: 5,  name: 'China',          short: 'CHN', winner: 'VER' },
    { r: 6,  name: 'Miami',          short: 'MIA', winner: 'NOR' },
    { r: 7,  name: 'Emilia-Romagna', short: 'IMO', winner: 'VER' },
    { r: 8,  name: 'Monaco',         short: 'MON', winner: 'LEC' },
    { r: 9,  name: 'Canada',         short: 'CAN', winner: 'VER' },
    { r: 10, name: 'Spain',          short: 'ESP', winner: 'VER' },
    { r: 11, name: 'Austria',        short: 'AUT', winner: 'RUS' },
    { r: 12, name: 'Britain',        short: 'GBR', winner: 'HAM' },
    { r: 13, name: 'Hungary',        short: 'HUN', winner: 'PIA' },
    { r: 14, name: 'Belgium',        short: 'BEL', winner: 'HAM' },
    { r: 15, name: 'Netherlands',    short: 'NED', winner: 'NOR' },
    { r: 16, name: 'Italy',          short: 'ITA', winner: 'LEC' },
    { r: 17, name: 'Azerbaijan',     short: 'AZE', winner: 'PIA' },
    { r: 18, name: 'Singapore',      short: 'SGP', winner: 'NOR' },
    { r: 19, name: 'Austin',         short: 'USA', winner: 'LEC' },
    { r: 20, name: 'Mexico',         short: 'MEX', winner: 'SAI' },
    { r: 21, name: 'São Paulo',      short: 'BRA', winner: 'VER' },
    { r: 22, name: 'Las Vegas',      short: 'LAS', winner: 'RUS' },
    { r: 23, name: 'Qatar',          short: 'QAT', winner: 'VER' },
    { r: 24, name: 'Abu Dhabi',      short: 'ABU', winner: 'NOR' },
  ],
  2025: [
    { r: 1,  name: 'Australia',      short: 'AUS', winner: 'NOR' },
    { r: 2,  name: 'China',          short: 'CHN', winner: 'PIA' },
    { r: 3,  name: 'Japan',          short: 'JPN', winner: 'VER' },
    { r: 4,  name: 'Bahrain',        short: 'BHR', winner: 'PIA' },
    { r: 5,  name: 'Saudi Arabia',   short: 'SAU', winner: 'PIA' },
    { r: 6,  name: 'Miami',          short: 'MIA', winner: 'PIA' },
    { r: 7,  name: 'Emilia-Romagna', short: 'IMO', winner: 'VER' },
    { r: 8,  name: 'Monaco',         short: 'MON', winner: 'NOR' },
    { r: 9,  name: 'Spain',          short: 'ESP', winner: 'PIA' },
    { r: 10, name: 'Canada',         short: 'CAN', winner: 'RUS' },
    { r: 11, name: 'Austria',        short: 'AUT', winner: 'NOR' },
    { r: 12, name: 'Britain',        short: 'GBR', winner: 'NOR' },
    { r: 13, name: 'Belgium',        short: 'BEL', winner: 'PIA' },
    { r: 14, name: 'Hungary',        short: 'HUN', winner: 'NOR' },
    { r: 15, name: 'Netherlands',    short: 'NED', winner: 'PIA' },
    { r: 16, name: 'Italy',          short: 'ITA', winner: 'NOR' },
    { r: 17, name: 'Azerbaijan',     short: 'AZE', winner: 'VER' },
    { r: 18, name: 'Singapore',      short: 'SGP', winner: 'RUS' },
    { r: 19, name: 'Austin',         short: 'USA', winner: 'NOR' },
    { r: 20, name: 'Mexico',         short: 'MEX', winner: 'LEC' },
    { r: 21, name: 'São Paulo',      short: 'BRA', winner: 'PIA' },
    { r: 22, name: 'Las Vegas',      short: 'LAS', winner: 'NOR' },
    { r: 23, name: 'Qatar',          short: 'QAT', winner: 'PIA' },
    { r: 24, name: 'Abu Dhabi',      short: 'ABU', winner: 'NOR' },
  ],
  // 2026: live season — first 12 raced, rest predicted
  2026: [
    { r: 1,  name: 'Bahrain',        short: 'BHR', winner: 'NOR' },
    { r: 2,  name: 'Saudi Arabia',   short: 'SAU', winner: 'VER' },
    { r: 3,  name: 'Australia',      short: 'AUS', winner: 'NOR' },
    { r: 4,  name: 'Japan',          short: 'JPN', winner: 'PIA' },
    { r: 5,  name: 'China',          short: 'CHN', winner: 'VER' },
    { r: 6,  name: 'Miami',          short: 'MIA', winner: 'NOR' },
    { r: 7,  name: 'Imola',          short: 'IMO', winner: 'PIA' },
    { r: 8,  name: 'Monaco',         short: 'MON', winner: 'LEC' },
    { r: 9,  name: 'Spain',          short: 'ESP', winner: 'NOR' },
    { r: 10, name: 'Canada',         short: 'CAN', winner: 'VER' },
    { r: 11, name: 'Austria',        short: 'AUT', winner: 'NOR' },
    { r: 12, name: 'Britain',        short: 'GBR', winner: 'NOR' },
    { r: 13, name: 'Hungary',        short: 'HUN', pred: 'NOR', conf: 0.41 },
    { r: 14, name: 'Belgium',        short: 'BEL', pred: 'VER', conf: 0.38 },
    { r: 15, name: 'Netherlands',    short: 'NED', pred: 'VER', conf: 0.44 },
    { r: 16, name: 'Italy',          short: 'ITA', pred: 'NOR', conf: 0.36 },
    { r: 17, name: 'Azerbaijan',     short: 'AZE', pred: 'PIA', conf: 0.29 },
    { r: 18, name: 'Singapore',      short: 'SGP', pred: 'NOR', conf: 0.42 },
    { r: 19, name: 'Austin',         short: 'USA', pred: 'NOR', conf: 0.35 },
    { r: 20, name: 'Mexico',         short: 'MEX', pred: 'VER', conf: 0.40 },
    { r: 21, name: 'São Paulo',      short: 'BRA', pred: 'NOR', conf: 0.33 },
    { r: 22, name: 'Las Vegas',      short: 'LAS', pred: 'VER', conf: 0.37 },
    { r: 23, name: 'Qatar',          short: 'QAT', pred: 'VER', conf: 0.43 },
    { r: 24, name: 'Abu Dhabi',      short: 'ABU', pred: 'NOR', conf: 0.31 },
  ],
};

// Expanded driver roster so 2021-2025 winners resolve.
const DRIVERS_EXT = {
  NOR: { name: 'Lando Norris',     team: 'McLaren',      abbr: 'NOR' },
  VER: { name: 'Max Verstappen',   team: 'Red Bull',     abbr: 'VER' },
  PIA: { name: 'Oscar Piastri',    team: 'McLaren',      abbr: 'PIA' },
  LEC: { name: 'Charles Leclerc',  team: 'Ferrari',      abbr: 'LEC' },
  RUS: { name: 'George Russell',   team: 'Mercedes',     abbr: 'RUS' },
  HAM: { name: 'Lewis Hamilton',   team: 'Ferrari',      abbr: 'HAM' },
  ANT: { name: 'Kimi Antonelli',   team: 'Mercedes',     abbr: 'ANT' },
  SAI: { name: 'Carlos Sainz',     team: 'Williams',     abbr: 'SAI' },
  ALO: { name: 'Fernando Alonso',  team: 'Aston Martin', abbr: 'ALO' },
  GAS: { name: 'Pierre Gasly',     team: 'Alpine',       abbr: 'GAS' },
  PER: { name: 'Sergio Pérez',     team: 'Red Bull',     abbr: 'PER' },
  OCO: { name: 'Esteban Ocon',     team: 'Alpine',       abbr: 'OCO' },
  RIC: { name: 'Daniel Ricciardo', team: 'McLaren',      abbr: 'RIC' },
  BOT: { name: 'Valtteri Bottas',  team: 'Mercedes',     abbr: 'BOT' },
};

// Championship standings snapshots by (season, round).
// Tip-of-the-iceberg: top-5 per snapshot is enough; we lerp for intermediate rounds.
const STANDINGS_2026 = {
  // round -> [{id, pts, wdc, podium, dnf, std}]
  6: [
    { id: 'NOR', pts: 138, wdc: 0.36, podium: 0.72, dnf: 0.03, std: 22 },
    { id: 'VER', pts: 121, wdc: 0.30, podium: 0.58, dnf: 0.05, std: 24 },
    { id: 'PIA', pts: 109, wdc: 0.18, podium: 0.54, dnf: 0.05, std: 26 },
    { id: 'LEC', pts:  88, wdc: 0.09, podium: 0.38, dnf: 0.08, std: 29 },
    { id: 'RUS', pts:  72, wdc: 0.04, podium: 0.32, dnf: 0.07, std: 27 },
    { id: 'HAM', pts:  64, wdc: 0.02, podium: 0.28, dnf: 0.09, std: 31 },
    { id: 'ANT', pts:  52, wdc: 0.008, podium: 0.19, dnf: 0.12, std: 34 },
    { id: 'SAI', pts:  31, wdc: 0.003, podium: 0.09, dnf: 0.09, std: 22 },
  ],
  9: [
    { id: 'NOR', pts: 212, wdc: 0.348, podium: 0.70, dnf: 0.04, std: 23 },
    { id: 'VER', pts: 188, wdc: 0.298, podium: 0.60, dnf: 0.06, std: 26 },
    { id: 'PIA', pts: 171, wdc: 0.184, podium: 0.55, dnf: 0.05, std: 27 },
    { id: 'LEC', pts: 144, wdc: 0.094, podium: 0.42, dnf: 0.08, std: 30 },
    { id: 'RUS', pts: 121, wdc: 0.051, podium: 0.36, dnf: 0.07, std: 28 },
    { id: 'HAM', pts: 102, wdc: 0.027, podium: 0.30, dnf: 0.09, std: 32 },
    { id: 'ANT', pts:  84, wdc: 0.011, podium: 0.21, dnf: 0.12, std: 35 },
    { id: 'SAI', pts:  51, wdc: 0.004, podium: 0.10, dnf: 0.09, std: 22 },
  ],
  12: [
    { id: 'NOR', pts: 298, wdc: 0.342, podium: 0.68, dnf: 0.04, std: 24 },
    { id: 'VER', pts: 274, wdc: 0.287, podium: 0.61, dnf: 0.06, std: 27 },
    { id: 'PIA', pts: 240, wdc: 0.181, podium: 0.55, dnf: 0.05, std: 26 },
    { id: 'LEC', pts: 203, wdc: 0.094, podium: 0.44, dnf: 0.08, std: 31 },
    { id: 'RUS', pts: 168, wdc: 0.052, podium: 0.38, dnf: 0.07, std: 28 },
    { id: 'HAM', pts: 142, wdc: 0.028, podium: 0.31, dnf: 0.09, std: 33 },
    { id: 'ANT', pts: 118, wdc: 0.010, podium: 0.22, dnf: 0.12, std: 35 },
    { id: 'SAI', pts:  72, wdc: 0.004, podium: 0.11, dnf: 0.09, std: 22 },
  ],
};

// Trend lines (sparklines) keyed by cutoff round — just a flavor variant each.
const SPARKS_BY_ROUND = {
  6:  { NOR: [0.18,0.22,0.25,0.28,0.34,0.36], VER: [0.52,0.48,0.44,0.38,0.32,0.30],
        PIA: [0.12,0.14,0.15,0.17,0.17,0.18], LEC: [0.08,0.09,0.08,0.10,0.09,0.09],
        RUS: [0.05,0.04,0.04,0.05,0.04,0.04] },
  9:  { NOR: [0.18,0.22,0.25,0.28,0.34,0.33,0.34,0.35,0.348],
        VER: [0.52,0.48,0.44,0.38,0.32,0.31,0.30,0.30,0.298],
        PIA: [0.12,0.14,0.15,0.17,0.17,0.18,0.18,0.18,0.184],
        LEC: [0.08,0.09,0.08,0.10,0.09,0.09,0.10,0.09,0.094],
        RUS: [0.05,0.04,0.04,0.05,0.04,0.05,0.05,0.05,0.051] },
  12: { NOR: [0.18,0.22,0.25,0.21,0.28,0.31,0.29,0.33,0.30,0.34,0.34,0.342],
        VER: [0.52,0.48,0.44,0.41,0.38,0.34,0.35,0.31,0.30,0.29,0.29,0.287],
        PIA: [0.12,0.14,0.15,0.17,0.16,0.18,0.17,0.18,0.19,0.18,0.18,0.181],
        LEC: [0.08,0.07,0.08,0.10,0.09,0.09,0.10,0.09,0.10,0.10,0.09,0.094],
        RUS: [0.05,0.04,0.04,0.05,0.05,0.04,0.05,0.05,0.05,0.05,0.05,0.052] },
};

// Helper: get a standings snapshot for any season + cutoff round by nearest snapshot.
function getStandingsAt(season, cutoffRound) {
  if (season === 2026) {
    // Choose snapshot ≤ cutoff, else earliest
    const keys = Object.keys(STANDINGS_2026).map(Number).sort((a,b) => a - b);
    let chosen = keys[0];
    for (const k of keys) if (k <= cutoffRound) chosen = k;
    return { round: chosen, rows: STANDINGS_2026[chosen] };
  }
  // For historical seasons we generate a standings-flavoured table from the champion
  const meta = SEASONS_META[season];
  const champ = meta?.champion;
  const runner = meta?.runnerUp;
  // Just mark top-2 as champ/runner using 2026 shape for a plausible display
  const base = STANDINGS_2026[12];
  return {
    round: cutoffRound,
    rows: base.map((row, i) => {
      if (i === 0 && champ) return { ...row, id: champ };
      if (i === 1 && runner) return { ...row, id: runner };
      return row;
    }),
  };
}

function getSparksAt(season, cutoffRound) {
  if (season !== 2026) return SPARKS_BY_ROUND[12];
  const keys = Object.keys(SPARKS_BY_ROUND).map(Number).sort((a,b) => a - b);
  let chosen = keys[0];
  for (const k of keys) if (k <= cutoffRound) chosen = k;
  return SPARKS_BY_ROUND[chosen];
}

Object.assign(window, {
  SEASONS_META, SEASON_RACES, DRIVERS_EXT,
  STANDINGS_2026, SPARKS_BY_ROUND,
  getStandingsAt, getSparksAt,
});
