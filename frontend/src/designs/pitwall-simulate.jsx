// Direction A — PIT WALL · Simulate page
// Dark telemetry aesthetic. Hazard amber accent. JetBrains Mono for numbers.
// Shows a running simulation mid-tick — progress, live results, parameter panel,
// cadence history, circuit-by-circuit predicted winners.

function PitWallSimulate({ theme = 'dark' }) {
  const dark = theme === 'dark';
  // Tokens
  const T = dark ? {
    bg:    '#0b0c0e',
    panel: '#13151a',
    sunk:  '#0a0b0d',
    rule:  'rgba(255,255,255,0.06)',
    ruleStrong: 'rgba(255,255,255,0.12)',
    text:  '#e7e5e0',
    dim:   'rgba(231,229,224,0.55)',
    faint: 'rgba(231,229,224,0.32)',
    amber: '#F5A623',         // oklch(0.78 0.17 70)
    amberDim: 'rgba(245,166,35,0.14)',
    ok:    '#4ADE80',
    hot:   '#EF4444',
  } : {
    bg:    '#f4f2ec',
    panel: '#ffffff',
    sunk:  '#eceae3',
    rule:  'rgba(15,15,15,0.08)',
    ruleStrong: 'rgba(15,15,15,0.16)',
    text:  '#0f1012',
    dim:   'rgba(15,15,15,0.55)',
    faint: 'rgba(15,15,15,0.32)',
    amber: '#B37610',
    amberDim: 'rgba(179,118,16,0.12)',
    ok:    '#0E8A4A',
    hot:   '#C22A22',
  };

  const progress = 0.67; // pretend-running sim
  const eta      = '1.8s';
  const nSims    = 10000;
  const runsDone = Math.round(nSims * progress);

  // ── building blocks ────────────────────────────────────────────────
  const Label = ({ children, style }) => (
    <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: T.faint, fontWeight: 600, ...style }}>{children}</div>
  );

  const Rule = ({ style }) => (
    <div style={{ height: 1, background: T.rule, ...style }} />
  );

  const Pip = ({ color, size = 7 }) => (
    <span style={{ display: 'inline-block', width: size, height: size,
                   background: color, flexShrink: 0 }} />
  );

  // Sparkline for per-driver probability evolution
  const Spark = ({ data, color, w = 60, h = 18 }) => {
    const min = Math.min(...data), max = Math.max(...data);
    const r = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / r) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" />
      </svg>
    );
  };

  // Full-bleed chrome
  return (
    <div className="pw-frame" style={{ width: '100%', height: '100%', background: T.bg,
        color: T.text, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column',
        fontSize: 12, position: 'relative', overflow: 'hidden' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div style={{ height: 40, borderBottom: `1px solid ${T.rule}`,
          display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
            borderRight: `1px solid ${T.rule}` }}>
          <div style={{ width: 18, height: 18, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, border: `1.5px solid ${T.amber}` }} />
            <div style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
                background: T.amber }} />
          </div>
          <span className="pw-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' }}>
            PITWALL<span style={{ color: T.amber }}>/</span>SIM
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {['Dashboard', 'Simulate', 'What-If', 'Replay', 'Game'].map((t, i) => {
            const active = t === 'Simulate';
            return (
              <div key={t} style={{ display: 'flex', alignItems: 'center', padding: '0 16px',
                  color: active ? T.text : T.dim,
                  borderBottom: active ? `2px solid ${T.amber}` : '2px solid transparent',
                  fontSize: 11, fontWeight: 500, position: 'relative',
                  background: active ? T.amberDim : 'transparent' }}>
                <span className="pw-mono" style={{ fontSize: 9, color: T.faint, marginRight: 6 }}>
                  {String(i+1).padStart(2,'0')}
                </span>
                {t}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Status readout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 16px',
            borderLeft: `1px solid ${T.rule}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.ok,
                animation: 'pw-pulse 1.2s ease-in-out infinite' }} />
            <span className="pw-mono" style={{ fontSize: 10, color: T.dim }}>BACKEND · 62ms</span>
          </div>
          <div className="pw-mono" style={{ fontSize: 10, color: T.dim }}>S·2026</div>
          <div className="pw-mono" style={{ fontSize: 10, color: T.dim }}>14:23:07 UTC</div>
          <div style={{ width: 20, height: 20, border: `1px solid ${T.rule}`, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 4, background: T.text }} />
          </div>
        </div>
      </div>

      {/* ── HERO STRIP: big amber progress readout ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 280px',
          borderBottom: `1px solid ${T.rule}`, flexShrink: 0 }}>

        {/* Run signature */}
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${T.rule}` }}>
          <Label>run signature</Label>
          <div className="pw-mono" style={{ fontSize: 13, marginTop: 8, color: T.text }}>
            r_2026_0847_<span style={{ color: T.amber }}>3fe1</span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <div>
              <Label>monte carlo</Label>
              <div className="pw-mono" style={{ fontSize: 14, marginTop: 2 }}>10,000</div>
            </div>
            <div>
              <Label>chaos</Label>
              <div className="pw-mono" style={{ fontSize: 14, marginTop: 2 }}>0.15</div>
            </div>
            <div>
              <Label>weather</Label>
              <div className="pw-mono" style={{ fontSize: 14, marginTop: 2 }}>HIST</div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ padding: '14px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Label>simulation in flight</Label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
                <div className="pw-mono" style={{ fontSize: 44, fontWeight: 700,
                    letterSpacing: '-0.03em', lineHeight: 1, color: T.amber }}>
                  {Math.round(progress * 100)}
                </div>
                <div className="pw-mono" style={{ fontSize: 20, color: T.amber, lineHeight: 1 }}>%</div>
                <div style={{ marginLeft: 20 }}>
                  <div className="pw-mono" style={{ fontSize: 11, color: T.dim }}>
                    {runsDone.toLocaleString()} / {nSims.toLocaleString()}
                  </div>
                  <div className="pw-mono" style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                    ETA {eta}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ background: 'transparent', border: `1px solid ${T.ruleStrong}`,
                  color: T.text, padding: '5px 10px', fontSize: 10, letterSpacing: '0.1em',
                  textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
                Abort
              </button>
              <button style={{ background: T.amberDim, border: `1px solid ${T.amber}`,
                  color: T.amber, padding: '5px 10px', fontSize: 10, letterSpacing: '0.1em',
                  textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
                Snapshot
              </button>
            </div>
          </div>

          {/* Tick bar */}
          <div style={{ marginTop: 14, display: 'flex', gap: 2, height: 24 }}>
            {Array.from({ length: 60 }).map((_, i) => {
              const filled = i / 60 < progress;
              const hot    = i === Math.floor(progress * 60);
              return (
                <div key={i} style={{ flex: 1,
                    background: hot ? T.amber : filled ? T.amber : T.rule,
                    opacity: hot ? 1 : filled ? (0.3 + (i / 60) * 0.7) : 1,
                    transition: 'opacity 200ms ease' }} />
              );
            })}
          </div>

          {/* Live log */}
          <div className="pw-mono" style={{ marginTop: 10, fontSize: 10, color: T.dim, display: 'flex', gap: 18 }}>
            <span><span style={{ color: T.amber }}>▸</span> sim #6,712 · Hungary · winner PIA · t=1.42s</span>
            <span style={{ color: T.faint }}>sim #6,711 · Hungary · winner NOR · t=1.41s</span>
          </div>
        </div>

        {/* Channel strip */}
        <div style={{ padding: '14px 20px', borderLeft: `1px solid ${T.rule}`,
            display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>channels</Label>
          {[
            ['DRIVERS',    '20',  T.text],
            ['CIRCUITS',   '12',  T.text],
            ['DNFs/RUN',   '1.2', T.amber],
            ['SC EVENTS',  '0.7', T.amber],
            ['PIT CYCLES', '2.1', T.text],
          ].map(([k, v, c]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 10, alignItems: 'baseline' }}>
              <span style={{ color: T.dim, letterSpacing: '0.08em' }}>{k}</span>
              <span className="pw-mono" style={{ color: c, fontSize: 12 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', flex: 1, minHeight: 0 }}>

        {/* LEFT — Parameters */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'hidden' }}>

          <div>
            <Label>parameters</Label>
          </div>

          {/* N sims slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, color: T.dim }}>MONTE CARLO RUNS</span>
              <span className="pw-mono" style={{ fontSize: 16, fontWeight: 700, color: T.amber }}>
                10,000
              </span>
            </div>
            {/* slider track */}
            <div style={{ marginTop: 10, height: 4, background: T.rule, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%',
                  background: T.amber }} />
              <div style={{ position: 'absolute', left: '40%', top: -4, width: 2, height: 12,
                  background: T.amber }} />
            </div>
            <div className="pw-mono" style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: T.faint, marginTop: 6 }}>
              <span>1K</span><span>10K</span><span>25K</span><span>50K</span>
            </div>
          </div>

          {/* Chaos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: T.dim }}>CHAOS FACTOR</span>
              <span className="pw-mono" style={{ fontSize: 12, color: T.amber }}>0.15</span>
            </div>
            <div style={{ marginTop: 10, height: 4, background: T.rule, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '28%',
                  background: T.amber }} />
            </div>
          </div>

          {/* Weather */}
          <div>
            <span style={{ fontSize: 11, color: T.dim }}>WEATHER MODEL</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
              {[
                ['HISTORICAL', true],
                ['DRY', false],
                ['RANDOM', false],
                ['MONSOON', false],
              ].map(([k, on]) => (
                <div key={k} style={{ padding: '6px 8px',
                    background: on ? T.amberDim : 'transparent',
                    border: `1px solid ${on ? T.amber : T.rule}`,
                    fontSize: 9, letterSpacing: '0.1em',
                    color: on ? T.amber : T.dim,
                    textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
                  {k}
                </div>
              ))}
            </div>
          </div>

          {/* Reliability */}
          <div>
            <span style={{ fontSize: 11, color: T.dim }}>RELIABILITY</span>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {[['HIST', true], ['OPT', false], ['PES', false]].map(([k, on]) => (
                <div key={k} style={{ flex: 1, padding: '6px 0',
                    background: on ? T.amberDim : 'transparent',
                    border: `1px solid ${on ? T.amber : T.rule}`,
                    fontSize: 9, letterSpacing: '0.1em',
                    color: on ? T.amber : T.dim,
                    textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
                  {k}
                </div>
              ))}
            </div>
          </div>

          <Rule />

          {/* Run history */}
          <div>
            <Label style={{ marginBottom: 10 }}>run cadence · last 12h</Label>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 42 }}>
              {[12, 18, 14, 22, 11, 26, 19, 31, 24, 28, 15, 22, 33, 29, 35, 26, 38, 31, 42, 28, 44, 36, 48, 67].map((v, i) => (
                <div key={i} style={{ flex: 1, height: `${(v/70)*100}%`,
                    background: i === 23 ? T.amber : T.ruleStrong }} />
              ))}
            </div>
            <div className="pw-mono" style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: T.faint, marginTop: 6 }}>
              <span>02:00</span><span>08:00</span><span>14:00</span>
            </div>
          </div>
        </div>

        {/* CENTER — Live championship */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column',
            gap: 12, overflow: 'hidden' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <Label>live championship · converging</Label>
              <span className="pw-mono" style={{ fontSize: 9, color: T.amber }}>
                ● updating
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <span className="pw-mono" style={{ fontSize: 10, color: T.dim }}>σ CONVERGING</span>
              <span className="pw-mono" style={{ fontSize: 10, color: T.ok }}>✓ STABLE</span>
            </div>
          </div>

          {/* Header row */}
          <div style={{ display: 'grid',
              gridTemplateColumns: '22px 26px 1fr 90px 62px 56px 70px 56px',
              gap: 12, padding: '6px 0', fontSize: 9, letterSpacing: '0.14em',
              color: T.faint, borderBottom: `1px solid ${T.rule}`,
              textTransform: 'uppercase', fontWeight: 600 }}>
            <span>P</span>
            <span></span>
            <span>DRIVER</span>
            <span>WDC %</span>
            <span>± 2σ</span>
            <span>EXP PTS</span>
            <span>TREND · 11 RACES</span>
            <span style={{ textAlign: 'right' }}>DNF</span>
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {DRIVERS.slice(0, 8).map((d, i) => {
              const teamColor = TEAM_COLORS[d.team];
              const isTop = i === 0;
              return (
                <div key={d.id} style={{ display: 'grid',
                    gridTemplateColumns: '22px 26px 1fr 90px 62px 56px 70px 56px',
                    gap: 12, padding: '10px 0', alignItems: 'center',
                    borderBottom: `1px solid ${T.rule}`,
                    background: isTop ? T.amberDim : 'transparent',
                    marginLeft: isTop ? -20 : 0, marginRight: isTop ? -20 : 0,
                    paddingLeft: isTop ? 20 : 0, paddingRight: isTop ? 20 : 0,
                    position: 'relative' }}>
                  {isTop && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 2, background: T.amber }} />}
                  <span className="pw-mono" style={{ fontSize: 13, fontWeight: 700,
                      color: isTop ? T.amber : T.dim, textAlign: 'right' }}>
                    {String(i+1).padStart(2,'0')}
                  </span>
                  <Pip color={teamColor} size={8} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text,
                        letterSpacing: '-0.01em' }}>
                      {d.name}
                    </div>
                    <div className="pw-mono" style={{ fontSize: 9, color: T.faint, marginTop: 1,
                        letterSpacing: '0.08em' }}>
                      {d.abbr} · {d.team.toUpperCase()}
                    </div>
                  </div>
                  {/* WDC bar */}
                  <div>
                    <div className="pw-mono" style={{ fontSize: 12, fontWeight: 700,
                        color: isTop ? T.amber : T.text }}>
                      {(d.wdc*100).toFixed(1)}%
                    </div>
                    <div style={{ height: 2, background: T.rule, marginTop: 3,
                        position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${(d.wdc/0.4)*100}%`, background: isTop ? T.amber : teamColor }} />
                    </div>
                  </div>
                  <span className="pw-mono" style={{ fontSize: 10, color: T.dim }}>
                    ±{d.std}
                  </span>
                  <span className="pw-mono" style={{ fontSize: 11, color: T.text }}>
                    {d.pts}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {SPARKS[d.id]
                      ? <Spark data={SPARKS[d.id]} color={isTop ? T.amber : teamColor} />
                      : <div style={{ width: 60, height: 1, background: T.rule }} />}
                  </div>
                  <span className="pw-mono" style={{ fontSize: 10, color: T.dim, textAlign: 'right' }}>
                    {(d.dnf*100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Circuit forecast + constructors */}
        <div style={{ borderLeft: `1px solid ${T.rule}`, padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>

          {/* Constructors mini */}
          <div>
            <Label style={{ marginBottom: 10 }}>constructors · wcc</Label>
            {[
              ['McLaren',   0.612, 756],
              ['Red Bull',  0.214, 622],
              ['Ferrari',   0.118, 553],
              ['Mercedes',  0.042, 487],
              ['Williams',  0.013, 212],
            ].map(([team, p, pts], i) => (
              <div key={team} style={{ display: 'grid',
                  gridTemplateColumns: '10px 1fr 44px 36px', gap: 8,
                  alignItems: 'center', padding: '6px 0',
                  borderBottom: i < 4 ? `1px solid ${T.rule}` : 'none' }}>
                <Pip color={TEAM_COLORS[team]} />
                <span style={{ fontSize: 11, color: T.text }}>{team}</span>
                <span className="pw-mono" style={{ fontSize: 11, color: i === 0 ? T.amber : T.text,
                    textAlign: 'right', fontWeight: 600 }}>
                  {(p*100).toFixed(1)}%
                </span>
                <span className="pw-mono" style={{ fontSize: 10, color: T.dim, textAlign: 'right' }}>
                  {pts}
                </span>
              </div>
            ))}
          </div>

          {/* Remaining races */}
          <div>
            <Label style={{ marginBottom: 10 }}>remaining · predicted winner</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {RACES.filter(r => !r.done).slice(0, 8).map(r => {
                const driver = DRIVERS.find(d => d.id === r.pred);
                return (
                  <div key={r.r} style={{ display: 'grid',
                      gridTemplateColumns: '22px 1fr 30px 50px', gap: 8, alignItems: 'center',
                      padding: '6px 0' }}>
                    <span className="pw-mono" style={{ fontSize: 10, color: T.faint,
                        letterSpacing: '0.08em' }}>
                      R{String(r.r).padStart(2,'0')}
                    </span>
                    <span style={{ fontSize: 11, color: T.text }}>{r.name}</span>
                    <span className="pw-mono" style={{ fontSize: 10, color: T.amber,
                        fontWeight: 700 }}>
                      {r.pred}
                    </span>
                    {/* confidence bar */}
                    <div style={{ height: 4, background: T.rule, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${r.conf * 100}%`,
                          background: driver ? TEAM_COLORS[driver.team] : T.amber }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ────────────────────────────────────── */}
      <div style={{ height: 28, borderTop: `1px solid ${T.rule}`,
          display: 'flex', alignItems: 'center', flexShrink: 0,
          fontSize: 10, color: T.faint, fontFamily: 'JetBrains Mono, monospace' }}>
        <div style={{ padding: '0 14px', borderRight: `1px solid ${T.rule}`, color: T.amber }}>
          ● LIVE
        </div>
        <div style={{ padding: '0 14px', borderRight: `1px solid ${T.rule}` }}>
          WS /sim/stream
        </div>
        <div style={{ padding: '0 14px', borderRight: `1px solid ${T.rule}` }}>
          FastF1 · v3.4.2 · synced
        </div>
        <div style={{ padding: '0 14px', borderRight: `1px solid ${T.rule}` }}>
          1,984 historical results indexed
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 14px', borderLeft: `1px solid ${T.rule}` }}>
          <span style={{ color: T.ok }}>●</span> backend · <span style={{ color: T.text }}>62ms</span>
        </div>
        <div style={{ padding: '0 14px', borderLeft: `1px solid ${T.rule}` }}>
          mem 312MB
        </div>
        <div style={{ padding: '0 14px', borderLeft: `1px solid ${T.rule}` }}>
          build 0847.3fe1
        </div>
      </div>
    </div>
  );
}

window.PitWallSimulate = PitWallSimulate;
