// Direction A — PIT WALL · Simulate (v2, deep dive)
// Season picker + chronological race drawer. Click a race => "simulate through R_N".
// Standings and next-race prediction update based on selected cutoff.

function PitWallSimulateV2({ theme = 'dark', initialSeason = 2026, initialCutoff = 12 }) {
  const dark = theme === 'dark';
  const T = dark ? {
    bg:'#0b0c0e', panel:'#13151a', sunk:'#0a0b0d',
    rule:'rgba(255,255,255,0.06)', ruleStrong:'rgba(255,255,255,0.12)',
    text:'#e7e5e0', dim:'rgba(231,229,224,0.55)', faint:'rgba(231,229,224,0.32)',
    amber:'#F5A623', amberDim:'rgba(245,166,35,0.14)',
    ok:'#4ADE80', hot:'#EF4444',
  } : {
    bg:'#f4f2ec', panel:'#ffffff', sunk:'#eceae3',
    rule:'rgba(15,15,15,0.08)', ruleStrong:'rgba(15,15,15,0.16)',
    text:'#0f1012', dim:'rgba(15,15,15,0.55)', faint:'rgba(15,15,15,0.32)',
    amber:'#B37610', amberDim:'rgba(179,118,16,0.12)',
    ok:'#0E8A4A', hot:'#C22A22',
  };

  const [season, setSeason] = React.useState(initialSeason);
  const [cutoff, setCutoff] = React.useState(initialCutoff); // round "simulate through"
  const [weather, setWeather] = React.useState('HISTORICAL');
  const [reliability, setReliability] = React.useState('HIST');
  const [chaos] = React.useState(0.15);
  const [nSims] = React.useState(10000);
  const [running, setRunning] = React.useState(true);

  const races = SEASON_RACES[season] ?? [];
  const meta  = SEASONS_META[season] ?? {};
  const isLive = season === 2026;

  // Last actually-raced round in this season (by data)
  const lastRacedRound = React.useMemo(() => {
    let last = 0;
    for (const r of races) if (r.winner) last = Math.max(last, r.r);
    return last;
  }, [races]);

  // Make sure cutoff is valid when season changes
  React.useEffect(() => {
    setCutoff(Math.min(lastRacedRound, isLive ? 12 : meta.rounds || lastRacedRound));
  }, [season]); // eslint-disable-line

  // Derived data
  const standings = getStandingsAt(season, cutoff);
  const sparks = getSparksAt(season, cutoff);
  const cutoffRace = races.find(r => r.r === cutoff);
  const nextRace   = races.find(r => r.r === cutoff + 1);
  const progress   = Math.min(1, (cutoff / (meta.rounds || 22)));

  const driverInfo = (id) => DRIVERS_EXT[id] || { name: id, team: 'McLaren', abbr: id };

  // ── primitives ─────────────────────────────────────────────────
  const Label = ({ children, style }) => (
    <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: T.faint, fontWeight: 600, ...style }}>{children}</div>
  );
  const Pip = ({ color, size = 7 }) => (
    <span style={{ display: 'inline-block', width: size, height: size, background: color, flexShrink: 0 }} />
  );
  const Spark = ({ data, color, w = 60, h = 18 }) => {
    if (!data) return <div style={{ width: w, height: h }} />;
    const min = Math.min(...data), max = Math.max(...data);
    const r = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / r) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return <svg width={w} height={h} style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" />
    </svg>;
  };

  // Chip style helpers
  const chipBase = {
    padding: '5px 10px', fontSize: 10, letterSpacing: '0.1em',
    fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
    transition: 'all 150ms ease', userSelect: 'none',
  };

  return (
    <div className="pw-frame" style={{ width: '100%', height: '100%', background: T.bg,
        color: T.text, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column',
        fontSize: 12, overflow: 'hidden' }}>

      {/* ── TOP BAR ───────────────────────────────────────────── */}
      <div style={{ height: 40, borderBottom: `1px solid ${T.rule}`,
          display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px',
            borderRight: `1px solid ${T.rule}` }}>
          <div style={{ width:18, height:18, position:'relative' }}>
            <div style={{ position:'absolute', inset:0, border:`1.5px solid ${T.amber}` }} />
            <div style={{ position:'absolute', top:4, left:4, right:4, bottom:4, background: T.amber }} />
          </div>
          <span className="pw-mono" style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em' }}>
            PITWALL<span style={{ color: T.amber }}>/</span>SIM
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'stretch' }}>
          {['Dashboard','Simulate','What-If','Replay','Game'].map((t,i) => {
            const active = t === 'Simulate';
            return (
              <div key={t} style={{ display:'flex', alignItems:'center', padding:'0 16px',
                  color: active ? T.text : T.dim,
                  borderBottom: active ? `2px solid ${T.amber}` : '2px solid transparent',
                  fontSize:11, fontWeight:500,
                  background: active ? T.amberDim : 'transparent' }}>
                <span className="pw-mono" style={{ fontSize:9, color: T.faint, marginRight:6 }}>
                  {String(i+1).padStart(2,'0')}
                </span>
                {t}
              </div>
            );
          })}
        </div>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', alignItems:'center', gap:16, padding:'0 16px',
            borderLeft: `1px solid ${T.rule}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background: T.ok,
                animation:'pw-pulse 1.2s ease-in-out infinite' }} />
            <span className="pw-mono" style={{ fontSize:10, color: T.dim }}>BACKEND · 62ms</span>
          </div>
          <div className="pw-mono" style={{ fontSize:10, color: T.dim }}>S·{season}</div>
          <div className="pw-mono" style={{ fontSize:10, color: T.dim }}>R·{String(cutoff).padStart(2,'0')}</div>
        </div>
      </div>

      {/* ── SEASON PICKER STRIP ─────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'stretch', borderBottom:`1px solid ${T.rule}`, flexShrink: 0 }}>
        <div style={{ padding:'10px 20px', borderRight:`1px solid ${T.rule}`,
            display:'flex', flexDirection:'column', gap:2, minWidth: 190 }}>
          <Label>active season</Label>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:4 }}>
            <span className="pw-mono" style={{ fontSize:28, fontWeight:700, letterSpacing:'-0.02em',
                color: T.text, lineHeight:1 }}>
              {season}
            </span>
            {isLive && (
              <span className="pw-mono" style={{ fontSize:9, color: T.ok, letterSpacing:'0.14em',
                  border:`1px solid ${T.ok}`, padding:'1px 5px' }}>
                ● LIVE
              </span>
            )}
            {!isLive && meta.champion && (
              <span className="pw-mono" style={{ fontSize:9, color: T.amber, letterSpacing:'0.14em' }}>
                ★ {meta.champion}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 18px', flex:1 }}>
          {[2021, 2023, 2024, 2025, 2026].map(s => {
            const on = s === season;
            return (
              <div key={s} onClick={() => setSeason(s)}
                  style={{ ...chipBase, fontWeight: on ? 700 : 500,
                    background: on ? T.amber : 'transparent',
                    color: on ? '#0b0c0e' : T.dim,
                    border: `1px solid ${on ? T.amber : T.rule}`,
                    padding: '6px 14px', fontSize: 11 }}>
                {s}
                {s === 2026 && <span style={{ marginLeft:6, fontSize:8, color: on ? '#0b0c0e' : T.ok }}>●</span>}
              </div>
            );
          })}
          <div style={{ width:1, height:22, background: T.rule, margin:'0 8px' }} />
          <span className="pw-mono" style={{ fontSize:10, color: T.dim, letterSpacing:'0.12em' }}>
            SIMULATE THROUGH
          </span>
          <div className="pw-mono" style={{ fontSize:13, color: T.amber, fontWeight:700,
              padding:'4px 10px', background: T.amberDim, border:`1px solid ${T.amber}` }}>
            R{String(cutoff).padStart(2,'0')} · {cutoffRace?.name?.toUpperCase() ?? '—'}
          </div>
        </div>
        <div style={{ padding:'10px 20px', borderLeft:`1px solid ${T.rule}`, minWidth: 220,
            display:'flex', flexDirection:'column', gap:3 }}>
          <Label>season progress</Label>
          <div className="pw-mono" style={{ fontSize:13, color: T.text, marginTop:2 }}>
            {cutoff} / {meta.rounds || races.length}
            <span style={{ color: T.faint, marginLeft:8 }}>
              · {Math.round(progress*100)}%
            </span>
          </div>
          <div style={{ height:3, background: T.rule, marginTop:6, position:'relative' }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:0,
                width:`${progress*100}%`, background: T.amber }} />
          </div>
        </div>
      </div>

      {/* ── RACE DRAWER (the new card) ──────────────────────── */}
      <div style={{ padding:'14px 20px 16px', borderBottom:`1px solid ${T.rule}`,
          background: T.panel, flexShrink: 0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
            marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
            <Label>{season} schedule · click any race to simulate through it</Label>
            {!isLive && (
              <span className="pw-mono" style={{ fontSize:9, color: T.dim }}>
                all {races.length} rounds · champion <span style={{ color: T.amber }}>{meta.champion}</span>
              </span>
            )}
            {isLive && (
              <span className="pw-mono" style={{ fontSize:9, color: T.dim }}>
                {lastRacedRound} raced · {races.length - lastRacedRound} predicted
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <span className="pw-mono" style={{ fontSize:9, color: T.faint, display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10, height:10, background: T.amber }} /> active cutoff
            </span>
            <span className="pw-mono" style={{ fontSize:9, color: T.faint, display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10, height:10, background: T.ok }} /> raced
            </span>
            <span className="pw-mono" style={{ fontSize:9, color: T.faint, display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10, height:10, border: `1px solid ${T.dim}` }} /> predicted
            </span>
          </div>
        </div>

        {/* the grid */}
        <div style={{ display:'grid',
            gridTemplateColumns: `repeat(${races.length}, minmax(0, 1fr))`,
            gap: 4, alignItems: 'stretch' }}>
          {races.map(r => {
            const raced    = !!r.winner;
            const isCutoff = r.r === cutoff;
            const isNext   = r.r === cutoff + 1;
            const isAfter  = r.r > cutoff && !isNext;
            const color = raced ? T.ok : (isAfter ? T.dim : T.amber);
            const winnerId = r.winner || r.pred;
            const winnerColor = winnerId
              ? TEAM_COLORS[(DRIVERS_EXT[winnerId] || {}).team] || T.amber
              : T.rule;
            return (
              <div key={r.r} onClick={() => setCutoff(r.r)}
                  style={{
                    cursor: 'pointer', position:'relative',
                    padding:'8px 4px 6px',
                    background: isCutoff ? T.amberDim
                              : isNext   ? 'rgba(245,166,35,0.06)'
                              : 'transparent',
                    border: `1px solid ${isCutoff ? T.amber : T.rule}`,
                    display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                    transition: 'all 120ms ease' }}
                  onMouseEnter={(e) => { if (!isCutoff) e.currentTarget.style.background = 'rgba(245,166,35,0.08)' }}
                  onMouseLeave={(e) => { if (!isCutoff) e.currentTarget.style.background = isNext ? 'rgba(245,166,35,0.06)' : 'transparent' }}>
                <span className="pw-mono" style={{ fontSize:8, color: T.faint, letterSpacing:'0.1em' }}>
                  R{String(r.r).padStart(2,'0')}
                </span>
                <span className="pw-mono" style={{ fontSize:11, fontWeight:700,
                    color: isCutoff ? T.amber : T.text, letterSpacing:'0.04em' }}>
                  {r.short}
                </span>
                <div style={{ height:3, width:'100%', background: T.rule, position:'relative' }}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0,
                      width: raced || isCutoff ? '100%' : isAfter ? '0' : '55%',
                      background: color, opacity: isAfter && !isNext ? 0.2 : 1 }} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:3, height:10 }}>
                  {winnerId
                    ? <>
                        <Pip color={winnerColor} size={5} />
                        <span className="pw-mono" style={{ fontSize:8, color: raced ? T.text : T.dim,
                            letterSpacing:'0.05em' }}>
                          {winnerId}
                        </span>
                        {!raced && <span className="pw-mono" style={{ fontSize:7, color: T.faint }}>·pred</span>}
                      </>
                    : <span className="pw-mono" style={{ fontSize:8, color: T.faint }}>—</span>}
                </div>
                {isCutoff && (
                  <div style={{ position:'absolute', left:-1, right:-1, bottom:-1, height:2,
                      background: T.amber }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── HERO: simulation through R_N ─────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr 290px',
          borderBottom:`1px solid ${T.rule}`, flexShrink: 0 }}>

        <div style={{ padding:'14px 20px', borderRight:`1px solid ${T.rule}` }}>
          <Label>run signature</Label>
          <div className="pw-mono" style={{ fontSize:13, marginTop:6 }}>
            r_{season}_R{String(cutoff).padStart(2,'0')}_<span style={{ color: T.amber }}>3fe1</span>
          </div>
          <div style={{ display:'flex', gap:14, marginTop:10 }}>
            <div><Label>m.c.</Label>
              <div className="pw-mono" style={{ fontSize:13, marginTop:2 }}>{nSims.toLocaleString()}</div>
            </div>
            <div><Label>chaos</Label>
              <div className="pw-mono" style={{ fontSize:13, marginTop:2 }}>{chaos.toFixed(2)}</div>
            </div>
            <div><Label>weather</Label>
              <div className="pw-mono" style={{ fontSize:13, marginTop:2 }}>{weather.slice(0,4)}</div>
            </div>
          </div>
        </div>

        <div style={{ padding:'14px 24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <Label>
                {running ? 'simulating through' : 'snapshot at'} · R{String(cutoff).padStart(2,'0')} {cutoffRace?.name}
              </Label>
              <div style={{ display:'flex', alignItems:'baseline', gap:14, marginTop:6 }}>
                <div className="pw-mono" style={{ fontSize:42, fontWeight:700,
                    letterSpacing:'-0.03em', lineHeight:1, color: T.amber }}>
                  {running ? '67' : '100'}
                </div>
                <div className="pw-mono" style={{ fontSize:18, color: T.amber, lineHeight:1 }}>%</div>
                <div style={{ marginLeft:16 }}>
                  <div className="pw-mono" style={{ fontSize:11, color: T.dim }}>
                    {running ? '6,712' : '10,000'} / 10,000 paths
                  </div>
                  <div className="pw-mono" style={{ fontSize:11, color: T.dim, marginTop:2 }}>
                    {running ? 'ETA 1.8s' : 'done · 2.7s elapsed'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <div onClick={() => setRunning(false)}
                  style={{ background:'transparent', border:`1px solid ${T.ruleStrong}`,
                  color: T.text, padding:'6px 10px', fontSize:10, letterSpacing:'0.1em',
                  textTransform:'uppercase', cursor:'pointer' }}>
                Abort
              </div>
              <div onClick={() => setRunning(true)}
                  style={{ background: T.amberDim, border:`1px solid ${T.amber}`,
                  color: T.amber, padding:'6px 10px', fontSize:10, letterSpacing:'0.1em',
                  textTransform:'uppercase', cursor:'pointer' }}>
                Re-run
              </div>
            </div>
          </div>

          <div style={{ marginTop:14, display:'flex', gap:2, height:22 }}>
            {Array.from({length:60}).map((_,i) => {
              const p = running ? 0.67 : 1;
              const filled = i/60 < p;
              const hot = running && i === Math.floor(p*60);
              return (
                <div key={i} style={{ flex:1,
                  background: hot ? T.amber : filled ? T.amber : T.rule,
                  opacity: hot ? 1 : filled ? (0.3 + (i/60)*0.7) : 1 }} />
              );
            })}
          </div>

          <div className="pw-mono" style={{ marginTop:10, fontSize:10, color: T.dim,
              display:'flex', gap:18 }}>
            <span>
              <span style={{ color: T.amber }}>▸</span> next race · {nextRace ? nextRace.name : 'Season complete'}
              {nextRace && nextRace.pred && <> · predicted winner <span style={{ color: T.amber, fontWeight:700 }}>{nextRace.pred}</span> · conf {Math.round((nextRace.conf||0)*100)}%</>}
            </span>
          </div>
        </div>

        <div style={{ padding:'14px 20px', borderLeft:`1px solid ${T.rule}`,
            display:'flex', flexDirection:'column', gap:5 }}>
          <Label>channels</Label>
          {[
            ['DRIVERS',    '20',  T.text],
            ['CIRCUITS',   String(races.length), T.text],
            ['SIMULATED',  `${cutoff}→${races.length}`, T.amber],
            ['DNFs/RUN',   '1.2', T.amber],
            ['SC EVENTS',  '0.7', T.amber],
          ].map(([k,v,c]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
                fontSize:10, alignItems:'baseline' }}>
              <span style={{ color: T.dim, letterSpacing:'0.08em' }}>{k}</span>
              <span className="pw-mono" style={{ color: c, fontSize:12 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'270px 1fr 310px',
          flex:1, minHeight:0 }}>

        {/* LEFT — params */}
        <div style={{ borderRight:`1px solid ${T.rule}`, padding:'14px 16px',
            display:'flex', flexDirection:'column', gap:16, overflow:'hidden' }}>
          <Label>parameters</Label>
          {/* slider */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontSize:11, color: T.dim }}>MONTE CARLO RUNS</span>
              <span className="pw-mono" style={{ fontSize:15, fontWeight:700, color: T.amber }}>
                {nSims.toLocaleString()}
              </span>
            </div>
            <div style={{ marginTop:10, height:4, background: T.rule, position:'relative' }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'40%', background: T.amber }} />
              <div style={{ position:'absolute', left:'40%', top:-4, width:2, height:12, background: T.amber }} />
            </div>
            <div className="pw-mono" style={{ display:'flex', justifyContent:'space-between',
                fontSize:9, color: T.faint, marginTop:6 }}>
              <span>1K</span><span>10K</span><span>25K</span><span>50K</span>
            </div>
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, color: T.dim }}>CHAOS FACTOR</span>
              <span className="pw-mono" style={{ fontSize:12, color: T.amber }}>0.15</span>
            </div>
            <div style={{ marginTop:10, height:4, background: T.rule, position:'relative' }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'28%', background: T.amber }} />
            </div>
          </div>

          {/* weather */}
          <div>
            <span style={{ fontSize:11, color: T.dim }}>WEATHER MODEL</span>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:8 }}>
              {['HISTORICAL','DRY','RANDOM','MONSOON'].map(k => {
                const on = k === weather;
                return (
                  <div key={k} onClick={() => setWeather(k)}
                      style={{ padding:'6px 8px',
                      background: on ? T.amberDim : 'transparent',
                      border: `1px solid ${on ? T.amber : T.rule}`,
                      fontSize:9, letterSpacing:'0.1em', color: on ? T.amber : T.dim,
                      textAlign:'center', fontFamily:'JetBrains Mono, monospace',
                      cursor:'pointer' }}>
                    {k}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span style={{ fontSize:11, color: T.dim }}>RELIABILITY</span>
            <div style={{ display:'flex', gap:4, marginTop:8 }}>
              {['HIST','OPT','PES'].map(k => {
                const on = k === reliability;
                return (
                  <div key={k} onClick={() => setReliability(k)}
                      style={{ flex:1, padding:'6px 0',
                      background: on ? T.amberDim : 'transparent',
                      border: `1px solid ${on ? T.amber : T.rule}`,
                      fontSize:9, letterSpacing:'0.1em', color: on ? T.amber : T.dim,
                      textAlign:'center', fontFamily:'JetBrains Mono, monospace',
                      cursor:'pointer' }}>
                    {k}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height:1, background: T.rule }} />

          {/* Season-aware footer */}
          <div>
            <Label style={{ marginBottom:8 }}>context · {season}</Label>
            <div style={{ display:'flex', flexDirection:'column', gap:5, fontSize:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color: T.dim }}>rounds in season</span>
                <span className="pw-mono" style={{ color: T.text }}>{meta.rounds}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color: T.dim }}>cutoff round</span>
                <span className="pw-mono" style={{ color: T.amber, fontWeight:700 }}>R{cutoff}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color: T.dim }}>rounds simulated</span>
                <span className="pw-mono" style={{ color: T.text }}>{(meta.rounds||races.length) - cutoff}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color: T.dim }}>historical champion</span>
                <span className="pw-mono" style={{ color: T.amber }}>{meta.champion ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER — standings projected from cutoff */}
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column',
            gap:10, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
              <Label>championship projection · from R{String(cutoff).padStart(2,'0')} forward</Label>
              <span className="pw-mono" style={{ fontSize:9, color: T.amber }}>● updating</span>
            </div>
            <span className="pw-mono" style={{ fontSize:9, color: T.dim }}>
              σ ±{standings.rows[0]?.std ?? 24} PTS · TOP-3 CONVERGED
            </span>
          </div>

          <div style={{ display:'grid',
              gridTemplateColumns:'22px 26px 1fr 90px 56px 70px 56px',
              gap:12, padding:'6px 0', fontSize:9, letterSpacing:'0.14em',
              color: T.faint, borderBottom:`1px solid ${T.rule}`,
              textTransform:'uppercase', fontWeight:600 }}>
            <span>P</span><span></span><span>DRIVER</span><span>WDC %</span>
            <span>EXP PTS</span><span>TREND</span><span style={{ textAlign:'right' }}>DNF</span>
          </div>

          <div>
            {standings.rows.map((row, i) => {
              const d = driverInfo(row.id);
              const teamColor = TEAM_COLORS[d.team] || T.amber;
              const isTop = i === 0;
              return (
                <div key={row.id} style={{ display:'grid',
                    gridTemplateColumns:'22px 26px 1fr 90px 56px 70px 56px',
                    gap:12, padding:'9px 0', alignItems:'center',
                    borderBottom:`1px solid ${T.rule}`,
                    background: isTop ? T.amberDim : 'transparent',
                    marginLeft: isTop ? -20 : 0, marginRight: isTop ? -20 : 0,
                    paddingLeft: isTop ? 20 : 0, paddingRight: isTop ? 20 : 0,
                    position:'relative' }}>
                  {isTop && <div style={{ position:'absolute', left:0, top:0, bottom:0,
                      width:2, background: T.amber }} />}
                  <span className="pw-mono" style={{ fontSize:13, fontWeight:700,
                      color: isTop ? T.amber : T.dim, textAlign:'right' }}>
                    {String(i+1).padStart(2,'0')}
                  </span>
                  <Pip color={teamColor} size={8} />
                  <div>
                    <div style={{ fontSize:12, fontWeight:600 }}>{d.name}</div>
                    <div className="pw-mono" style={{ fontSize:9, color: T.faint,
                        marginTop:1, letterSpacing:'0.08em' }}>
                      {d.abbr} · {d.team.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="pw-mono" style={{ fontSize:12, fontWeight:700,
                        color: isTop ? T.amber : T.text }}>
                      {(row.wdc*100).toFixed(1)}%
                    </div>
                    <div style={{ height:2, background: T.rule, marginTop:3, position:'relative' }}>
                      <div style={{ position:'absolute', left:0, top:0, height:'100%',
                          width:`${(row.wdc/0.4)*100}%`, background: isTop ? T.amber : teamColor }} />
                    </div>
                  </div>
                  <span className="pw-mono" style={{ fontSize:11 }}>{row.pts}</span>
                  <Spark data={sparks[row.id]} color={isTop ? T.amber : teamColor} />
                  <span className="pw-mono" style={{ fontSize:10, color: T.dim, textAlign:'right' }}>
                    {(row.dnf*100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Next race focus + constructors */}
        <div style={{ borderLeft:`1px solid ${T.rule}`, padding:'14px 18px',
            display:'flex', flexDirection:'column', gap:14, overflow:'hidden' }}>

          {/* next race card */}
          <div style={{ background: T.sunk, border:`1px solid ${T.amber}`,
              padding:'12px 14px', position:'relative' }}>
            <div style={{ position:'absolute', top:-1, left:-1, right:-1, height:2, background: T.amber }} />
            <Label style={{ color: T.amber }}>next race · predicted winner</Label>
            {nextRace ? (
              <>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:6 }}>
                  <span className="pw-mono" style={{ fontSize:10, color: T.faint }}>
                    R{String(nextRace.r).padStart(2,'0')}
                  </span>
                  <span style={{ fontSize:18, fontWeight:700, letterSpacing:'-0.01em' }}>
                    {nextRace.name}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10 }}>
                  <Pip color={TEAM_COLORS[driverInfo(nextRace.pred || nextRace.winner).team]} size={10} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>
                      {driverInfo(nextRace.pred || nextRace.winner).name}
                    </div>
                    <div className="pw-mono" style={{ fontSize:9, color: T.dim, marginTop:2,
                        letterSpacing:'0.08em' }}>
                      {(nextRace.pred || nextRace.winner)} · {driverInfo(nextRace.pred || nextRace.winner).team.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="pw-mono" style={{ fontSize:20, fontWeight:700, color: T.amber,
                        lineHeight:1, textAlign:'right' }}>
                      {Math.round((nextRace.conf || 0.55) * 100)}%
                    </div>
                    <div className="pw-mono" style={{ fontSize:8, color: T.faint,
                        letterSpacing:'0.12em', textAlign:'right', marginTop:1 }}>
                      CONFIDENCE
                    </div>
                  </div>
                </div>
                {/* podium candidates */}
                <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${T.rule}` }}>
                  <Label style={{ marginBottom:6 }}>podium mix</Label>
                  {(() => {
                    const pool = standings.rows.slice(0, 5);
                    return pool.slice(0, 3).map((row, i) => {
                      const d = driverInfo(row.id);
                      const p = [0.62, 0.41, 0.28][i];
                      return (
                        <div key={row.id} style={{ display:'grid',
                            gridTemplateColumns:'14px 1fr 36px', gap:6,
                            alignItems:'center', padding:'3px 0' }}>
                          <span className="pw-mono" style={{ fontSize:10, color: T.dim }}>P{i+1}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <Pip color={TEAM_COLORS[d.team]} size={5} />
                            <span style={{ fontSize:11 }}>{d.name}</span>
                          </div>
                          <span className="pw-mono" style={{ fontSize:10, color: T.amber,
                              textAlign:'right' }}>
                            {Math.round(p*100)}%
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            ) : (
              <div style={{ marginTop:10, fontSize:12, color: T.dim }}>
                Season complete. <span style={{ color: T.amber }}>{meta.champion}</span> wins the WDC.
              </div>
            )}
          </div>

          {/* Constructors */}
          <div>
            <Label style={{ marginBottom:8 }}>constructors · wcc (projected)</Label>
            {[
              ['McLaren', 0.612, 756],
              ['Red Bull', 0.214, 622],
              ['Ferrari', 0.118, 553],
              ['Mercedes', 0.042, 487],
              ['Williams', 0.013, 212],
            ].map(([team, p, pts], i) => (
              <div key={team} style={{ display:'grid',
                  gridTemplateColumns:'10px 1fr 44px 36px', gap:8,
                  alignItems:'center', padding:'5px 0',
                  borderBottom: i < 4 ? `1px solid ${T.rule}` : 'none' }}>
                <Pip color={TEAM_COLORS[team]} />
                <span style={{ fontSize:11 }}>{team}</span>
                <span className="pw-mono" style={{ fontSize:11, color: i === 0 ? T.amber : T.text,
                    textAlign:'right', fontWeight:600 }}>
                  {(p*100).toFixed(1)}%
                </span>
                <span className="pw-mono" style={{ fontSize:10, color: T.dim, textAlign:'right' }}>
                  {pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div style={{ height:26, borderTop:`1px solid ${T.rule}`,
          display:'flex', alignItems:'center', flexShrink:0,
          fontSize:10, color: T.faint, fontFamily:'JetBrains Mono, monospace' }}>
        <div style={{ padding:'0 14px', borderRight:`1px solid ${T.rule}`, color: T.amber }}>● LIVE</div>
        <div style={{ padding:'0 14px', borderRight:`1px solid ${T.rule}` }}>
          SEASON {season} · R{String(cutoff).padStart(2,'0')} · {running ? 'SIMULATING' : 'SNAPSHOT'}
        </div>
        <div style={{ padding:'0 14px', borderRight:`1px solid ${T.rule}` }}>
          cutoff {cutoffRace?.name || '—'}
        </div>
        <div style={{ flex:1 }} />
        <div style={{ padding:'0 14px', borderLeft:`1px solid ${T.rule}` }}>
          <span style={{ color: T.ok }}>●</span> backend · <span style={{ color: T.text }}>62ms</span>
        </div>
        <div style={{ padding:'0 14px', borderLeft:`1px solid ${T.rule}` }}>
          build 0847.3fe1
        </div>
      </div>
    </div>
  );
}

window.PitWallSimulateV2 = PitWallSimulateV2;
