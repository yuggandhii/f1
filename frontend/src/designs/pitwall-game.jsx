// Direction A — PIT WALL · Game page
// Pre-race prediction game. User ranks their top-5 for the upcoming GP.
// Shows leaderboard, streak, points history, competitor picks.

function PitWallGame({ theme = 'dark' }) {
  const dark = theme === 'dark';
  const T = dark ? {
    bg: '#0b0c0e', panel: '#13151a', sunk: '#0a0b0d',
    rule: 'rgba(255,255,255,0.06)', ruleStrong: 'rgba(255,255,255,0.12)',
    text: '#e7e5e0', dim: 'rgba(231,229,224,0.55)', faint: 'rgba(231,229,224,0.32)',
    amber: '#F5A623', amberDim: 'rgba(245,166,35,0.14)',
    ok: '#4ADE80', hot: '#EF4444',
  } : {
    bg: '#f4f2ec', panel: '#fff', sunk: '#eceae3',
    rule: 'rgba(15,15,15,0.08)', ruleStrong: 'rgba(15,15,15,0.16)',
    text: '#0f1012', dim: 'rgba(15,15,15,0.55)', faint: 'rgba(15,15,15,0.32)',
    amber: '#B37610', amberDim: 'rgba(179,118,16,0.12)',
    ok: '#0E8A4A', hot: '#C22A22',
  };

  const Label = ({ children, style }) => (
    <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: T.faint, fontWeight: 600, ...style }}>{children}</div>
  );
  const Pip = ({ color, size = 7 }) => (
    <span style={{ display: 'inline-block', width: size, height: size, background: color, flexShrink: 0 }} />
  );

  // User's pick order (mock state — top 5)
  const myPicks = ['NOR', 'VER', 'PIA', 'LEC', 'HAM'];
  const pool    = DRIVERS.filter(d => !myPicks.includes(d.id));
  const picked  = myPicks.map(id => DRIVERS.find(d => d.id === id));

  // Leaderboard
  const players = [
    { rank: 1,  handle: 'apex_overcut',  pts: 2847, streak: 7, delta: '+32', you: false },
    { rank: 2,  handle: 'trail_braker',  pts: 2791, streak: 4, delta: '+18', you: false },
    { rank: 3,  handle: 'you',           pts: 2684, streak: 5, delta: '+41', you: true  },
    { rank: 4,  handle: 'monza_chicane', pts: 2633, streak: 2, delta: '-7',  you: false },
    { rank: 5,  handle: 'slow_in_fast',  pts: 2551, streak: 3, delta: '+12', you: false },
    { rank: 6,  handle: 'tire_warmer',   pts: 2490, streak: 1, delta: '-15', you: false },
  ];

  return (
    <div className="pw-frame" style={{ width: '100%', height: '100%', background: T.bg,
        color: T.text, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column',
        fontSize: 12, position: 'relative', overflow: 'hidden' }}>

      {/* ── TOP BAR ── (same structure, Game active) */}
      <div style={{ height: 40, borderBottom: `1px solid ${T.rule}`,
          display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
            borderRight: `1px solid ${T.rule}` }}>
          <div style={{ width: 18, height: 18, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, border: `1.5px solid ${T.amber}` }} />
            <div style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, background: T.amber }} />
          </div>
          <span className="pw-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' }}>
            PITWALL<span style={{ color: T.amber }}>/</span>SIM
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {['Dashboard','Simulate','What-If','Replay','Game'].map((t,i) => {
            const active = t === 'Game';
            return (
              <div key={t} style={{ display: 'flex', alignItems: 'center', padding: '0 16px',
                  color: active ? T.text : T.dim,
                  borderBottom: active ? `2px solid ${T.amber}` : '2px solid transparent',
                  fontSize: 11, fontWeight: 500,
                  background: active ? T.amberDim : 'transparent' }}>
                <span className="pw-mono" style={{ fontSize: 9, color: T.faint, marginRight: 6 }}>
                  {String(i+1).padStart(2,'0')}
                </span>{t}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 16px',
            borderLeft: `1px solid ${T.rule}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.amber,
                animation: 'pw-pulse 1.2s ease-in-out infinite' }} />
            <span className="pw-mono" style={{ fontSize: 10, color: T.amber }}>PICKS LOCK IN 2h 14m</span>
          </div>
          <div className="pw-mono" style={{ fontSize: 10, color: T.dim }}>@you · 2,684 pts</div>
        </div>
      </div>

      {/* ── COUNTDOWN BANNER ── */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.rule}`,
          display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 28,
          alignItems: 'center', flexShrink: 0 }}>
        <div>
          <Label>round 13 · hungarian gp · predict pre-race</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6 }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
                fontFamily: 'Inter, sans-serif' }}>Hungaroring</div>
            <div className="pw-mono" style={{ fontSize: 11, color: T.dim, letterSpacing: '0.08em' }}>
              HUN · 4.381 KM · 70 LAPS · 32°C DRY
            </div>
          </div>
        </div>
        {[
          ['PICKS LOCK', '02:14:07', T.amber],
          ['YOUR STREAK', '5 GP', T.text],
          ['RANK · GLOBAL', '#3 of 12,482', T.text],
        ].map(([k,v,c]) => (
          <div key={k} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.14em', color: T.faint,
                textTransform: 'uppercase' }}>{k}</div>
            <div className="pw-mono" style={{ fontSize: 18, fontWeight: 700, color: c,
                marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', flex: 1, minHeight: 0 }}>

        {/* LEFT — Driver pool */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '14px 18px',
            display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>driver pool · drag to rank</Label>
            <span className="pw-mono" style={{ fontSize: 10, color: T.dim }}>20 · AVAILABLE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
            {pool.map(d => {
              const col = TEAM_COLORS[d.team];
              return (
                <div key={d.id} style={{ display: 'grid',
                    gridTemplateColumns: '8px 28px 1fr 42px 60px', gap: 10,
                    padding: '8px 10px', alignItems: 'center',
                    background: T.sunk, border: `1px solid ${T.rule}`, cursor: 'grab' }}>
                  <div style={{ width: 3, height: 14, background: col }} />
                  <span className="pw-mono" style={{ fontSize: 11, fontWeight: 700,
                      color: T.text, letterSpacing: '0.04em' }}>{d.abbr}</span>
                  <span style={{ fontSize: 11, color: T.text }}>{d.name}</span>
                  <span className="pw-mono" style={{ fontSize: 10, color: T.dim, textAlign: 'right' }}>
                    {(d.wdc*100).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 10, color: T.faint, letterSpacing: '0.08em',
                      textAlign: 'right' }}>
                    {d.team.toUpperCase()}
                  </span>
                </div>
              );
            })}
            {Array.from({length: 10}).map((_,i) => (
              <div key={'f'+i} style={{ display: 'grid',
                  gridTemplateColumns: '8px 28px 1fr 42px 60px', gap: 10,
                  padding: '8px 10px', alignItems: 'center',
                  background: T.sunk, border: `1px solid ${T.rule}`, opacity: 0.3 }}>
                <div style={{ width: 3, height: 14, background: T.rule }} />
                <span className="pw-mono" style={{ fontSize: 11, color: T.faint }}>—</span>
                <span style={{ fontSize: 11, color: T.faint }}>driver {11+i}</span>
                <span className="pw-mono" style={{ fontSize: 10, color: T.faint }}>—</span>
                <span style={{ fontSize: 10, color: T.faint }}>—</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — Your picks */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '14px 20px',
            display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>your podium + top 5 · hungary</Label>
            <span className="pw-mono" style={{ fontSize: 10, color: T.ok }}>● AUTO-SAVED</span>
          </div>

          {/* Pick slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {picked.map((d, i) => {
              const col = TEAM_COLORS[d.team];
              const pos = i + 1;
              const label = pos === 1 ? 'P1 · WIN' : pos === 2 ? 'P2' : pos === 3 ? 'P3 · PODIUM' : `P${pos}`;
              const pts = [25, 18, 15, 12, 10][i];
              const isPodium = i < 3;
              return (
                <div key={d.id} style={{ display: 'grid',
                    gridTemplateColumns: '36px 10px 46px 1fr 70px 60px', gap: 10,
                    padding: '12px 12px', alignItems: 'center',
                    background: isPodium ? T.amberDim : T.sunk,
                    border: `1px solid ${isPodium ? T.amber : T.ruleStrong}` }}>
                  <span className="pw-mono" style={{ fontSize: 14, fontWeight: 700,
                      color: isPodium ? T.amber : T.text, letterSpacing: '-0.02em' }}>
                    {String(pos).padStart(2,'0')}
                  </span>
                  <div style={{ width: 4, height: 20, background: col }} />
                  <span className="pw-mono" style={{ fontSize: 13, fontWeight: 700,
                      color: T.text }}>{d.abbr}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{d.name}</div>
                    <div className="pw-mono" style={{ fontSize: 9, color: T.faint,
                        letterSpacing: '0.08em', marginTop: 1 }}>
                      {d.team.toUpperCase()} · {label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="pw-mono" style={{ fontSize: 11, color: T.dim }}>IF CORRECT</div>
                    <div className="pw-mono" style={{ fontSize: 14, fontWeight: 700,
                        color: isPodium ? T.amber : T.text }}>+{pts} pts</div>
                  </div>
                  <div className="pw-mono" style={{ fontSize: 10, color: T.dim, textAlign: 'right' }}>
                    {(d.wdc*100).toFixed(1)}%<br/>wdc
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bonus row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              ['FASTEST LAP', 'NOR', '+5'],
              ['POLE POSITION', 'NOR', '+3'],
              ['FIRST DNF', 'HAM', '+4'],
            ].map(([k,v,p]) => (
              <div key={k} style={{ padding: '10px 12px', background: T.sunk,
                  border: `1px dashed ${T.ruleStrong}` }}>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', color: T.faint,
                    textTransform: 'uppercase' }}>{k}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'baseline', marginTop: 4 }}>
                  <span className="pw-mono" style={{ fontSize: 14, color: T.text,
                      fontWeight: 700 }}>{v}</span>
                  <span className="pw-mono" style={{ fontSize: 11, color: T.amber }}>{p}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button style={{ flex: 1, background: T.amber, border: 'none',
                color: dark ? '#0b0c0e' : '#fff', padding: '12px 18px',
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              Lock Picks
            </button>
            <button style={{ background: 'transparent', border: `1px solid ${T.ruleStrong}`,
                color: T.text, padding: '12px 18px',
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
              Reset
            </button>
          </div>
        </div>

        {/* RIGHT — Leaderboard + points log */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16,
            overflow: 'hidden' }}>

          {/* Leaderboard */}
          <div>
            <Label style={{ marginBottom: 10 }}>leaderboard · season</Label>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {players.map(p => (
                <div key={p.handle} style={{ display: 'grid',
                    gridTemplateColumns: '22px 1fr 50px 36px', gap: 8,
                    padding: '9px 8px', alignItems: 'center',
                    background: p.you ? T.amberDim : 'transparent',
                    borderBottom: `1px solid ${T.rule}`,
                    borderLeft: p.you ? `2px solid ${T.amber}` : '2px solid transparent' }}>
                  <span className="pw-mono" style={{ fontSize: 11, fontWeight: 700,
                      color: p.you ? T.amber : T.dim }}>
                    {String(p.rank).padStart(2,'0')}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: p.you ? 700 : 500,
                        color: T.text }}>
                      @{p.handle}
                    </div>
                    <div className="pw-mono" style={{ fontSize: 9, color: T.faint, marginTop: 1 }}>
                      streak {p.streak}
                    </div>
                  </div>
                  <span className="pw-mono" style={{ fontSize: 11, color: T.text,
                      textAlign: 'right', fontWeight: 600 }}>
                    {p.pts.toLocaleString()}
                  </span>
                  <span className="pw-mono" style={{ fontSize: 10,
                      color: p.delta.startsWith('+') ? T.ok : T.hot, textAlign: 'right' }}>
                    {p.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent scoring */}
          <div>
            <Label style={{ marginBottom: 10 }}>your last 5 rounds</Label>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56,
                borderBottom: `1px solid ${T.rule}`, paddingBottom: 4 }}>
              {[
                { gp: 'BHR', pts: 42 },
                { gp: 'AUS', pts: 61 },
                { gp: 'JPN', pts: 28 },
                { gp: 'MON', pts: 74 },
                { gp: 'ESP', pts: 49 },
                { gp: 'CAN', pts: 55 },
                { gp: 'AUT', pts: 81 },
                { gp: 'GBR', pts: 67 },
              ].map((r, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${(r.pts/100)*100}%`,
                      background: i === 7 ? T.amber : T.ruleStrong }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
              {['BHR','AUS','JPN','MON','ESP','CAN','AUT','GBR'].map((g,i) => (
                <div key={g} className="pw-mono" style={{ flex: 1, fontSize: 8,
                    color: i === 7 ? T.amber : T.faint, textAlign: 'center',
                    letterSpacing: '0.08em' }}>{g}</div>
              ))}
            </div>
          </div>

          {/* Next reward */}
          <div style={{ padding: '10px 12px', border: `1px dashed ${T.amber}`,
              background: T.amberDim }}>
            <div style={{ fontSize: 9, letterSpacing: '0.14em', color: T.amber,
                textTransform: 'uppercase', fontWeight: 700 }}>
              NEXT MILESTONE
            </div>
            <div style={{ fontSize: 12, color: T.text, marginTop: 4, lineHeight: 1.4 }}>
              Pick the podium correctly <span className="pw-mono" style={{ color: T.amber }}>3×</span> in a row — unlock <span style={{ color: T.amber }}>Gold Visor</span> badge.
            </div>
            <div style={{ marginTop: 8, height: 3, background: T.rule }}>
              <div style={{ width: '66%', height: '100%', background: T.amber }} />
            </div>
            <div className="pw-mono" style={{ fontSize: 9, color: T.faint, marginTop: 4 }}>
              2 OF 3 ACHIEVED
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM STATUS ── */}
      <div style={{ height: 28, borderTop: `1px solid ${T.rule}`,
          display: 'flex', alignItems: 'center', flexShrink: 0,
          fontSize: 10, color: T.faint, fontFamily: 'JetBrains Mono, monospace' }}>
        <div style={{ padding: '0 14px', borderRight: `1px solid ${T.rule}`, color: T.amber }}>
          ● PICKS OPEN
        </div>
        <div style={{ padding: '0 14px', borderRight: `1px solid ${T.rule}` }}>
          12,482 players · 8,847 locked
        </div>
        <div style={{ padding: '0 14px', borderRight: `1px solid ${T.rule}` }}>
          round 13 of 24
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 14px', borderLeft: `1px solid ${T.rule}` }}>
          your best round · monaco · 74 pts
        </div>
        <div style={{ padding: '0 14px', borderLeft: `1px solid ${T.rule}` }}>
          @you
        </div>
      </div>
    </div>
  );
}

window.PitWallGame = PitWallGame;
