// Direction B — VECTOR · Game page
// Editorial. Ranking slots as big numerals, leaderboard as a reader's column.

function VectorGame({ theme = 'light' }) {
  const light = theme === 'light';
  const T = light ? {
    bg: '#f4f2ec', paper: '#ffffff', sunk: '#ebe8e0',
    ink: '#0e0e10', mid: 'rgba(14,14,16,0.55)', faint: 'rgba(14,14,16,0.30)',
    rule: 'rgba(14,14,16,0.10)', strong: 'rgba(14,14,16,0.20)',
    cyan: '#0891B2', cyanDim: 'rgba(8,145,178,0.10)',
  } : {
    bg: '#0d1114', paper: '#151a1e', sunk: '#0a0d10',
    ink: '#f1efe8', mid: 'rgba(241,239,232,0.55)', faint: 'rgba(241,239,232,0.30)',
    rule: 'rgba(241,239,232,0.10)', strong: 'rgba(241,239,232,0.20)',
    cyan: '#22D3EE', cyanDim: 'rgba(34,211,238,0.12)',
  };

  const Eyebrow = ({ children, style }) => (
    <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: T.cyan, fontWeight: 600, ...style }}>{children}</div>
  );

  const myPicks = ['NOR', 'VER', 'PIA', 'LEC', 'HAM'];
  const pool = DRIVERS.filter(d => !myPicks.includes(d.id));
  const picked = myPicks.map(id => DRIVERS.find(d => d.id === id));

  const players = [
    { rank: 1, handle: 'apex_overcut',  pts: 2847, streak: 7, delta: '+32' },
    { rank: 2, handle: 'trail_braker',  pts: 2791, streak: 4, delta: '+18' },
    { rank: 3, handle: 'you',           pts: 2684, streak: 5, delta: '+41', you: true },
    { rank: 4, handle: 'monza_chicane', pts: 2633, streak: 2, delta: '-7' },
    { rank: 5, handle: 'slow_in_fast',  pts: 2551, streak: 3, delta: '+12' },
  ];

  return (
    <div className="vc-frame" style={{ width: '100%', height: '100%', background: T.bg,
        color: T.ink, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column',
        fontSize: 13, overflow: 'hidden' }}>

      {/* Masthead */}
      <div style={{ padding: '18px 40px 14px', borderBottom: `1px solid ${T.rule}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32 }}>
          <div>
            <div className="vc-serif" style={{ fontSize: 30, lineHeight: 1, fontStyle: 'italic',
                letterSpacing: '-0.01em' }}>
              Vector<span style={{ color: T.cyan }}>.</span>
            </div>
            <div className="vc-mono" style={{ fontSize: 9, color: T.mid, letterSpacing: '0.18em',
                textTransform: 'uppercase', marginTop: 2 }}>
              A motorsport analytics publication
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, paddingBottom: 4 }}>
            {['Dashboard','Simulate','What-If','Replay','Game'].map(t => {
              const active = t === 'Game';
              return (
                <div key={t} style={{ fontSize: 13, color: active ? T.ink : T.mid,
                    borderBottom: active ? `1.5px solid ${T.cyan}` : 'none',
                    paddingBottom: 2, fontWeight: active ? 600 : 400 }}>{t}</div>
              );
            })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="vc-mono" style={{ fontSize: 10, color: T.mid, letterSpacing: '0.1em' }}>
            @YOU · 2,684 PTS · RANK #3
          </div>
          <div className="vc-serif" style={{ fontSize: 18, fontStyle: 'italic', marginTop: 2 }}>
            Picks close in <span className="vc-mono" style={{
              fontStyle: 'normal', fontSize: 12, color: T.cyan }}>02:14:07</span>
          </div>
        </div>
      </div>

      {/* Headline */}
      <div style={{ padding: '22px 40px 18px', borderBottom: `1px solid ${T.rule}`,
          display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40, flexShrink: 0 }}>
        <div>
          <Eyebrow>the game · round 13</Eyebrow>
          <h1 className="vc-serif" style={{ fontSize: 46, lineHeight: 1.02, letterSpacing: '-0.02em',
              fontWeight: 400, margin: '6px 0 8px' }}>
            Your five for <span style={{ fontStyle: 'italic', color: T.cyan }}>Hungary.</span>
          </h1>
          <p style={{ fontSize: 13, color: T.mid, maxWidth: 580, lineHeight: 1.55 }}>
            Rank the top five. Podium picks score double. Bonus points for fastest lap, pole,
            and the first retirement. Your <span className="vc-mono" style={{ color: T.ink,
            fontWeight: 600 }}>five-round streak</span> puts Gold Visor within reach.
          </p>
        </div>
        <div style={{ border: `1px solid ${T.rule}`, padding: '14px 16px', background: T.paper }}>
          <Eyebrow>the circuit</Eyebrow>
          <div className="vc-serif" style={{ fontSize: 24, marginTop: 4, fontStyle: 'italic',
              letterSpacing: '-0.01em' }}>
            Hungaroring.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
            {[['LAPS','70'],['KM','4.381'],['TEMP','32°C']].map(([k,v]) => (
              <div key={k}>
                <div className="vc-mono" style={{ fontSize: 9, color: T.faint,
                    letterSpacing: '0.14em' }}>{k}</div>
                <div className="vc-serif" style={{ fontSize: 20, lineHeight: 1,
                    marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px',
          flex: 1, minHeight: 0 }}>

        {/* LEFT — driver pool */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '20px 28px 20px 40px',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Eyebrow>the grid · drag to rank</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pool.map(d => (
              <div key={d.id} style={{ display: 'grid',
                  gridTemplateColumns: '3px 44px 1fr auto', gap: 12,
                  padding: '11px 0', alignItems: 'center',
                  borderBottom: `1px solid ${T.rule}`, cursor: 'grab' }}>
                <div style={{ width: 3, height: 24, background: TEAM_COLORS[d.team] }} />
                <span className="vc-serif" style={{ fontSize: 22, fontStyle: 'italic',
                    letterSpacing: '-0.02em', color: T.ink, lineHeight: 1 }}>
                  {d.abbr}
                </span>
                <div>
                  <div style={{ fontSize: 13 }}>{d.name}</div>
                  <div className="vc-mono" style={{ fontSize: 9, color: T.mid, marginTop: 2,
                      letterSpacing: '0.1em' }}>
                    {d.team.toUpperCase()}
                  </div>
                </div>
                <span className="vc-mono" style={{ fontSize: 10, color: T.mid }}>
                  {(d.wdc*100).toFixed(1)}% wdc
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — your picks */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '20px 28px',
            display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Eyebrow>your ballot</Eyebrow>
            <span className="vc-mono" style={{ fontSize: 9, color: T.cyan, letterSpacing: '0.14em' }}>
              ● AUTO-SAVED
            </span>
          </div>

          {picked.map((d, i) => {
            const pts = [25, 18, 15, 12, 10][i];
            const isPodium = i < 3;
            const col = TEAM_COLORS[d.team];
            return (
              <div key={d.id} style={{ display: 'grid',
                  gridTemplateColumns: '56px 4px 1fr 90px', gap: 14,
                  padding: '14px 16px', alignItems: 'center',
                  background: isPodium ? T.cyanDim : T.paper,
                  border: `1px solid ${isPodium ? T.cyan : T.rule}` }}>
                <span className="vc-serif" style={{ fontSize: 42, fontStyle: 'italic',
                    letterSpacing: '-0.03em', color: isPodium ? T.cyan : T.ink, lineHeight: 1 }}>
                  {i+1}
                </span>
                <div style={{ width: 4, height: 36, background: col }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {d.name}
                  </div>
                  <div className="vc-mono" style={{ fontSize: 9, color: T.mid, marginTop: 3,
                      letterSpacing: '0.12em' }}>
                    {d.abbr} · {d.team.toUpperCase()} · {i === 0 ? 'WIN' : i === 1 ? 'P2' : i === 2 ? 'PODIUM' : `P${i+1}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="vc-serif" style={{ fontSize: 22, letterSpacing: '-0.02em',
                      color: isPodium ? T.cyan : T.ink, lineHeight: 1 }}>
                    +{pts}
                  </div>
                  <div className="vc-mono" style={{ fontSize: 8, color: T.mid, marginTop: 2,
                      letterSpacing: '0.12em' }}>
                    IF CORRECT
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bonus picks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
            {[['Fastest lap','NOR','+5'],['Pole','NOR','+3'],['First DNF','HAM','+4']].map(([k,v,p]) => (
              <div key={k} style={{ padding: '10px 12px', border: `1px dashed ${T.strong}`,
                  background: T.paper }}>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', color: T.faint,
                    textTransform: 'uppercase' }}>{k}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'baseline', marginTop: 4 }}>
                  <span className="vc-serif" style={{ fontSize: 18, fontStyle: 'italic',
                      letterSpacing: '-0.02em' }}>{v}</span>
                  <span className="vc-mono" style={{ fontSize: 11, color: T.cyan }}>{p}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button style={{ flex: 1, background: T.cyan, border: 'none', color: '#fff',
                padding: '14px 18px', fontSize: 13, fontFamily: 'inherit',
                cursor: 'pointer', letterSpacing: '-0.01em', fontWeight: 500 }}>
              <span className="vc-serif" style={{ fontStyle: 'italic', fontSize: 16 }}>Lock</span>{' '}
              my picks →
            </button>
          </div>
        </div>

        {/* RIGHT — leaderboard + streak chart */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column',
            gap: 18, overflow: 'hidden' }}>

          <div>
            <Eyebrow>leaderboard</Eyebrow>
            <div className="vc-serif" style={{ fontSize: 20, marginTop: 2, fontStyle: 'italic',
                letterSpacing: '-0.01em' }}>
              Top of the grid.
            </div>
            <div style={{ marginTop: 10 }}>
              {players.map(p => (
                <div key={p.handle} style={{ display: 'grid',
                    gridTemplateColumns: '20px 1fr 50px 30px', gap: 8,
                    padding: '9px 0', alignItems: 'baseline',
                    borderBottom: `1px solid ${T.rule}`,
                    background: p.you ? T.cyanDim : 'transparent',
                    marginLeft: p.you ? -8 : 0, marginRight: p.you ? -8 : 0,
                    paddingLeft: p.you ? 8 : 0, paddingRight: p.you ? 8 : 0 }}>
                  <span className="vc-serif" style={{ fontSize: 16, fontStyle: 'italic',
                      color: p.you ? T.cyan : T.faint, letterSpacing: '-0.02em' }}>
                    {p.rank}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: p.you ? 600 : 400 }}>@{p.handle}</div>
                    <div className="vc-mono" style={{ fontSize: 9, color: T.mid, marginTop: 1 }}>
                      streak {p.streak}
                    </div>
                  </div>
                  <span className="vc-mono" style={{ fontSize: 11, textAlign: 'right',
                      fontWeight: 600 }}>
                    {p.pts.toLocaleString()}
                  </span>
                  <span className="vc-mono" style={{ fontSize: 9,
                      color: p.delta.startsWith('+') ? T.cyan : '#C22A22',
                      textAlign: 'right' }}>
                    {p.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>your last eight</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 54,
                borderBottom: `1px solid ${T.rule}`, paddingBottom: 4, marginTop: 8 }}>
              {[42, 61, 28, 74, 49, 55, 81, 67].map((pts, i) => (
                <div key={i} style={{ flex: 1, height: `${(pts/90)*100}%`,
                    background: i === 7 ? T.cyan : T.strong, opacity: i === 7 ? 1 : 0.5 }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
              {['BHR','AUS','JPN','MON','ESP','CAN','AUT','GBR'].map((g,i) => (
                <div key={g} className="vc-mono" style={{ flex: 1, fontSize: 8,
                    color: i === 7 ? T.cyan : T.faint, textAlign: 'center',
                    letterSpacing: '0.08em' }}>{g}</div>
              ))}
            </div>
          </div>

          {/* Milestone */}
          <div style={{ padding: '12px 14px', borderLeft: `3px solid ${T.cyan}`,
              background: T.cyanDim }}>
            <Eyebrow>next milestone</Eyebrow>
            <div className="vc-serif" style={{ fontSize: 16, fontStyle: 'italic',
                marginTop: 4, lineHeight: 1.35 }}>
              Three podiums in a row —<br/>unlock <span style={{ color: T.cyan }}>Gold Visor.</span>
            </div>
            <div style={{ marginTop: 10, height: 2, background: T.rule }}>
              <div style={{ width: '66%', height: '100%', background: T.cyan }} />
            </div>
            <div className="vc-mono" style={{ fontSize: 9, color: T.mid, marginTop: 4,
                letterSpacing: '0.12em' }}>
              2 OF 3 ACHIEVED
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.VectorGame = VectorGame;
