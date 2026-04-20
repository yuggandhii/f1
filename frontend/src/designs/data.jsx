// Shared mock data for all 4 frames
const DRIVERS = [
  { id: 'NOR', name: 'Lando Norris',      team: 'McLaren',      abbr: 'NOR', wdc: 0.342, pts: 402, podium: 0.68, dnf: 0.04, std: 24 },
  { id: 'VER', name: 'Max Verstappen',    team: 'Red Bull',     abbr: 'VER', wdc: 0.287, pts: 388, podium: 0.61, dnf: 0.06, std: 27 },
  { id: 'PIA', name: 'Oscar Piastri',     team: 'McLaren',      abbr: 'PIA', wdc: 0.181, pts: 354, podium: 0.55, dnf: 0.05, std: 26 },
  { id: 'LEC', name: 'Charles Leclerc',   team: 'Ferrari',      abbr: 'LEC', wdc: 0.094, pts: 312, podium: 0.44, dnf: 0.08, std: 31 },
  { id: 'RUS', name: 'George Russell',    team: 'Mercedes',     abbr: 'RUS', wdc: 0.052, pts: 289, podium: 0.38, dnf: 0.07, std: 28 },
  { id: 'HAM', name: 'Lewis Hamilton',    team: 'Ferrari',      abbr: 'HAM', wdc: 0.028, pts: 241, podium: 0.31, dnf: 0.09, std: 33 },
  { id: 'ANT', name: 'Kimi Antonelli',    team: 'Mercedes',     abbr: 'ANT', wdc: 0.010, pts: 198, podium: 0.22, dnf: 0.12, std: 35 },
  { id: 'SAI', name: 'Carlos Sainz',      team: 'Williams',     abbr: 'SAI', wdc: 0.004, pts: 124, podium: 0.11, dnf: 0.09, std: 22 },
  { id: 'ALO', name: 'Fernando Alonso',   team: 'Aston Martin', abbr: 'ALO', wdc: 0.001, pts: 88,  podium: 0.06, dnf: 0.11, std: 19 },
  { id: 'GAS', name: 'Pierre Gasly',      team: 'Alpine',       abbr: 'GAS', wdc: 0.001, pts: 62,  podium: 0.03, dnf: 0.13, std: 18 },
];

const TEAM_COLORS = {
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
};

// Sparkline points (race-by-race probability evolution) — fake but believable
const SPARKS = {
  NOR: [0.18, 0.22, 0.25, 0.21, 0.28, 0.31, 0.29, 0.33, 0.30, 0.34, 0.34],
  VER: [0.52, 0.48, 0.44, 0.41, 0.38, 0.34, 0.35, 0.31, 0.30, 0.29, 0.29],
  PIA: [0.12, 0.14, 0.15, 0.17, 0.16, 0.18, 0.17, 0.18, 0.19, 0.18, 0.18],
  LEC: [0.08, 0.07, 0.08, 0.10, 0.09, 0.09, 0.10, 0.09, 0.10, 0.10, 0.09],
  RUS: [0.05, 0.04, 0.04, 0.05, 0.05, 0.04, 0.05, 0.05, 0.05, 0.05, 0.05],
};

// 24 races of 2026 — subset visible at any time
const RACES = [
  { r: 1,  name: 'Bahrain',        short: 'BHR', winner: 'NOR', done: true  },
  { r: 2,  name: 'Saudi Arabia',   short: 'SAU', winner: 'VER', done: true  },
  { r: 3,  name: 'Australia',      short: 'AUS', winner: 'NOR', done: true  },
  { r: 4,  name: 'Japan',          short: 'JPN', winner: 'PIA', done: true  },
  { r: 5,  name: 'China',          short: 'CHN', winner: 'VER', done: true  },
  { r: 6,  name: 'Miami',          short: 'MIA', winner: 'NOR', done: true  },
  { r: 7,  name: 'Imola',          short: 'IMO', winner: 'PIA', done: true  },
  { r: 8,  name: 'Monaco',         short: 'MON', winner: 'LEC', done: true  },
  { r: 9,  name: 'Spain',          short: 'ESP', winner: 'NOR', done: true  },
  { r: 10, name: 'Canada',         short: 'CAN', winner: 'VER', done: true  },
  { r: 11, name: 'Austria',        short: 'AUT', winner: 'NOR', done: true  },
  { r: 12, name: 'Britain',        short: 'GBR', winner: 'NOR', done: true  },
  { r: 13, name: 'Hungary',        short: 'HUN', winner: null,  done: false, pred: 'NOR', conf: 0.41 },
  { r: 14, name: 'Belgium',        short: 'BEL', winner: null,  done: false, pred: 'VER', conf: 0.38 },
  { r: 15, name: 'Netherlands',    short: 'NED', winner: null,  done: false, pred: 'VER', conf: 0.44 },
  { r: 16, name: 'Italy',          short: 'ITA', winner: null,  done: false, pred: 'NOR', conf: 0.36 },
  { r: 17, name: 'Azerbaijan',     short: 'AZE', winner: null,  done: false, pred: 'PIA', conf: 0.29 },
  { r: 18, name: 'Singapore',      short: 'SGP', winner: null,  done: false, pred: 'NOR', conf: 0.42 },
  { r: 19, name: 'Austin',         short: 'USA', winner: null,  done: false, pred: 'NOR', conf: 0.35 },
  { r: 20, name: 'Mexico',         short: 'MEX', winner: null,  done: false, pred: 'VER', conf: 0.40 },
  { r: 21, name: 'São Paulo',      short: 'BRA', winner: null,  done: false, pred: 'NOR', conf: 0.33 },
  { r: 22, name: 'Las Vegas',      short: 'LAS', winner: null,  done: false, pred: 'VER', conf: 0.37 },
  { r: 23, name: 'Qatar',          short: 'QAT', winner: null,  done: false, pred: 'VER', conf: 0.43 },
  { r: 24, name: 'Abu Dhabi',      short: 'ABU', winner: null,  done: false, pred: 'NOR', conf: 0.31 },
];

Object.assign(window, { DRIVERS, TEAM_COLORS, SPARKS, RACES });
