// Direction B — VECTOR · Simulate page
// Editorial analytics. Instrument Serif display, Geist Mono numbers, cyan accent.

function VectorSimulate({ theme = 'light' }) {
  const light = theme === 'light';
  const T = light ? {
    bg: '#f4f2ec', paper: '#ffffff', sunk: '#ebe8e0',
    ink: '#0e0e10', mid: 'rgba(14,14,16,0.55)', faint: 'rgba(14,14,16,0.30)',
    rule: 'rgba(14,14,16,0.10)', strong: 'rgba(14,14,16,0.20)',
    cyan: '#0891B2', cyanDim: 'rgba(8,145,178,0.10)',
    warm: '#A8571A',
  } : {
    bg: '#0d1114', paper: '#151a1e', sunk: '#0a0d10',
    ink: '#f1efe8', mid: 'rgba(241,239,232,0.55)', faint: 'rgba(241,239,232,0.30)',
    rule: 'rgba(241,239,232,0.10)', strong: 'rgba(241,239,232,0.20)',
    cyan: '#22D3EE', cyanDim: 'rgba(34,211,238,0.12)',
    warm: '#F5A623',
  };

  const Eyebrow = ({ children, style }) => (
    <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: T.cyan, fontWeight: 600, ...style }}>{children}</div>
  );

  const Spark = ({ data, color, w = 80, h = 22 }) => {
    const min = Math.min(...data), max = Math.max(...data);
    const r = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / r) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
      <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" />
        {data.map((v, i) => {
          if (i !== data.length - 1) return null;
          const x = (i / (data.length - 1)) * w;
          const y = h - ((v - min) / r) * h;
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
        })}
      </svg>
    );
  };

  return (
    <div className="vc-frame" style={{ width: '100%', height: '100%', background: T.bg,
        color: T.ink, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column',
        fontSize: 13, position: 'relative', overflow: 'hidden' }}>

      {/* ── Masthead ── */}
      <div style={{ padding: '18px 40px 14px', borderBottom: `1px solid ${T.rule}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32 }}>
          <div>
            <div className="vc-serif" style={{ fontSize: 30, lineHeight: 1,
                fontStyle: 'italic', letterSpacing: '-0.01em' }}>
              Vector<span style={{ color: T.cyan }}>.</span>
            </div>
            <div className="vc-mono" style={{ fontSize: 9, color: T.mid, letterSpacing: '0.18em',
                textTransform: 'uppercase', marginTop: 2 }}>
              A motorsport analytics publication
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, paddingBottom: 4 }}>
            {['Dashboard','Simulate','What-If','Replay','Game'].map(t => {
              const active = t === 'Simulate';
              return (
                <div key={t} style={{ fontSize: 13,
                    color: active ? T.ink : T.mid,
                    borderBottom: active ? `1.5px solid ${T.cyan}` : 'none',
                    paddingBottom: 2, fontWeight: active ? 600 : 400 }}>
                  {t}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="vc-mono" style={{ fontSize: 10, color: T.mid, letterSpacing: '0.1em' }}>
            ISSUE · 2026 · ROUND 13
          </div>
          <div className="vc-serif" style={{ fontSize: 18, fontStyle: 'italic', marginTop: 2 }}>
            Saturday afternoon <span className="vc-mono" style={{
              fontStyle: 'normal', fontSize: 12, color: T.cyan }}>14:23 UTC</span>
          </div>
        </div>
      </div>

      {/* ── Hero headline ── */}
      <div style={{ padding: '26px 40px 20px', borderBottom: `1px solid ${T.rule}`,
          display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40, alignItems: 'end',
          flexShrink: 0 }}>
        <div>
          <Eyebrow>the simulation</Eyebrow>
          <h1 className="vc-serif" style={{ fontSize: 52, lineHeight: 1.02, letterSpacing: '-0.02em',
              fontWeight: 400, margin: '8px 0 10px' }}>
            Ten thousand seasons,<br/>
            <span style={{ fontStyle: 'italic', color: T.cyan }}>one title still in play.</span>
          </h1>
          <p style={{ fontSize: 14, color: T.mid, maxWidth: 640, lineHeight: 1.55 }}>
            With twelve rounds remaining, the Monte Carlo engine gives
            <span className="vc-mono" style={{ color: T.ink, fontWeight: 600 }}> Norris 34.2%</span>,
            <span className="vc-mono" style={{ color: T.ink, fontWeight: 600 }}> Verstappen 28.7%</span>, and
            <span className="vc-mono" style={{ color: T.ink, fontWeight: 600 }}> Piastri 18.1%</span> — the tightest three-way spread since 2007.
          </p>
        </div>

        {/* Run badge */}
        <div style={{ border: `1px solid ${T.rule}`, padding: '14px 16px', background: T.paper }}>
          <Eyebrow>current run</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            <div>
              <div className="vc-mono" style={{ fontSize: 9, color: T.faint, letterSpacing: '0.14em' }}>
                MONTE CARLO
              </div>
              <div className="vc-serif" style={{ fontSize: 28, lineHeight: 1 }}>10,000</div>
            </div>
            <div>
              <div className="vc-mono" style={{ fontSize: 9, color: T.faint, letterSpacing: '0.14em' }}>
                PROGRESS
              </div>
              <div className="vc-serif" style={{ fontSize: 28, lineHeight: 1, color: T.cyan }}>67<span style={{ fontSize: 18 }}>%</span></div>
            </div>
            <div>
              <div className="vc-mono" style={{ fontSize: 9, color: T.faint, letterSpacing: '0.14em' }}>
                CHAOS
              </div>
              <div className="vc-serif" style={{ fontSize: 20, lineHeight: 1 }}>0.15</div>
            </div>
            <div>
              <div className="vc-mono" style={{ fontSize: 9, color: T.faint, letterSpacing: '0.14em' }}>
                ETA
              </div>
              <div className="vc-serif" style={{ fontSize: 20, lineHeight: 1 }}>1.8s</div>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 2, background: T.rule, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '67%',
                background: T.cyan }} />
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', flex: 1, minHeight: 0 }}>

        {/* Left gutter — parameters as a "sidebar essay" */}
        <div style={{ borderRight: `1px solid ${T.rule}`, padding: '20px 22px 20px 40px',
            display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
          <div>
            <Eyebrow>parameters</Eyebrow>
            <div className="vc-serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 4,
                letterSpacing: '-0.01em' }}>
              Tune the model
            </div>
          </div>

          {/* slider — runs */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, color: T.mid }}>Monte Carlo runs</span>
              <span className="vc-mono" style={{ fontSize: 15, fontWeight: 700 }}>10,000</span>
            </div>
            <div style={{ marginTop: 10, height: 2, background: T.rule, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, height: '100%', width: '40%',
                  background: T.ink }} />
              <div style={{ position: 'absolute', left: '40%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: 10, height: 10, borderRadius: '50%', background: T.cyan,
                  border: `2px solid ${T.paper}`, boxShadow: `0 0 0 1px ${T.cyan}` }} />
            </div>
            <div className="vc-mono" style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: T.faint, marginTop: 8, letterSpacing: '0.1em' }}>
              <span>1K</span><span>50K</span>
            </div>
          </div>

          {/* Chaos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: T.mid }}>Chaos factor</span>
              <span className="vc-mono" style={{ fontSize: 12 }}>0.15</span>
            </div>
            <div style={{ marginTop: 10, height: 2, background: T.rule, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, height: '100%', width: '28%', background: T.ink }} />
              <div style={{ position: 'absolute', left: '28%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: 10, height: 10, borderRadius: '50%', background: T.cyan,
                  border: `2px solid ${T.paper}`, boxShadow: `0 0 0 1px ${T.cyan}` }} />
            </div>
          </div>

          {/* Pill toggles */}
          <div>
            <span style={{ fontSize: 11, color: T.mid }}>Weather</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {['historical','dry','random','monsoon'].map(w => {
                const on = w === 'historical';
                return (
                  <span key={w} style={{ padding: '4px 10px', fontSize: 10,
                      borderRadius: 999, letterSpacing: '0.04em',
                      background: on ? T.ink : 'transparent',
                      color: on ? T.paper : T.mid,
                      border: `1px solid ${on ? T.ink : T.rule}` }}>
                    {w}
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 11, color: T.mid }}>Reliability</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {['historical','optimistic','pessimistic'].map(r => {
                const on = r === 'historical';
                return (
                  <span key={r} style={{ padding: '4px 10px', fontSize: 10,
                      borderRadius: 999, letterSpacing: '0.04em',
                      background: on ? T.ink : 'transparent',
                      color: on ? T.paper : T.mid,
                      border: `1px solid ${on ? T.ink : T.rule}` }}>
                    {r}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Primary action */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={{ background: T.cyan, border: 'none', color: '#fff',
                padding: '14px 18px', fontSize: 13, fontFamily: 'inherit',
                cursor: 'pointer', letterSpacing: '-0.01em', fontWeight: 500 }}>
              <span className="vc-serif" style={{ fontStyle: 'italic', fontSize: 16 }}>Run</span>{' '}
              simulation →
            </button>
            <button style={{ background: 'transparent', border: `1px solid ${T.strong}`,
                color: T.ink, padding: '8px 14px', fontSize: 11, fontFamily: 'inherit',
                cursor: 'pointer', letterSpacing: '0.04em' }}>
              Compare to last run
            </button>
          </div>
        </div>

        {/* CENTER — the data */}
        <div style={{ padding: '22px 32px', overflow: 'hidden', display: 'flex',
            flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <Eyebrow>live standings</Eyebrow>
              <div className="vc-serif" style={{ fontSize: 24, marginTop: 2,
                  letterSpacing: '-0.01em' }}>
                Drivers' championship, <span style={{ fontStyle: 'italic' }}>converging.</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <span className="vc-mono" style={{ fontSize: 10, color: T.mid, letterSpacing: '0.08em' }}>
                σ CONVERGING
              </span>
              <span className="vc-mono" style={{ fontSize: 10, color: T.cyan, letterSpacing: '0.08em' }}>
                ● UPDATING
              </span>
            </div>
          </div>

          {/* Columns header */}
          <div style={{ display: 'grid',
              gridTemplateColumns: '26px 1fr 80px 100px 62px 90px',
              gap: 16, padding: '6px 0 4px',
              fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: T.faint, fontWeight: 600, borderBottom: `1px solid ${T.rule}` }}>
            <span>№</span><span>Driver</span><span>Wdc</span>
            <span>Probability</span><span style={{ textAlign: 'right' }}>Pts</span>
            <span style={{ textAlign: 'right' }}>Trend</span>
          </div>

          {/* Rows — big editorial numerals */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {DRIVERS.slice(0, 8).map((d, i) => {
              const col = TEAM_COLORS[d.team];
              const isTop = i === 0;
              return (
                <div key={d.id} style={{ display: 'grid',
                    gridTemplateColumns: '26px 1fr 80px 100px 62px 90px',
                    gap: 16, padding: '12px 0', alignItems: 'center',
                    borderBottom: `1px solid ${T.rule}` }}>
                  <span className="vc-serif" style={{ fontSize: 20, fontStyle: 'italic',
                      color: isTop ? T.cyan : T.faint, letterSpacing: '-0.02em',
                      lineHeight: 1 }}>
                    {i+1}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 3, height: 14, background: col }} />
                      <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>
                        {d.name}
                      </span>
                    </div>
                    <div className="vc-mono" style={{ fontSize: 9, color: T.mid, marginTop: 3,
                        letterSpacing: '0.12em', marginLeft: 11 }}>
                      {d.abbr} · {d.team}
                    </div>
                  </div>
                  <div>
                    <span className="vc-serif" style={{ fontSize: 26, fontWeight: 400,
                        letterSpacing: '-0.02em', color: isTop ? T.cyan : T.ink, lineHeight: 1 }}>
                      {(d.wdc*100).toFixed(1)}
                    </span>
                    <span className="vc-mono" style={{ fontSize: 10, color: T.mid,
                        marginLeft: 2 }}>%</span>
                  </div>
                  {/* horizontal bar */}
                  <div>
                    <div style={{ height: 6, background: T.sunk, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${(d.wdc/0.4)*100}%`,
                          background: isTop ? T.cyan : col }} />
                    </div>
                    <div className="vc-mono" style={{ fontSize: 9, color: T.faint, marginTop: 3 }}>
                      ±{d.std} pts · σ
                    </div>
                  </div>
                  <span className="vc-mono" style={{ fontSize: 13, textAlign: 'right' }}>
                    {d.pts}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {SPARKS[d.id]
                      ? <Spark data={SPARKS[d.id]} color={isTop ? T.cyan : col} />
                      : <div style={{ width: 80, height: 22, borderBottom: `1px solid ${T.rule}`,
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                          <span className="vc-mono" style={{ fontSize: 9, color: T.faint }}>—</span>
                        </div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pull quote */}
          <div style={{ padding: '16px 20px', borderLeft: `3px solid ${T.cyan}`,
              marginTop: 4, background: T.cyanDim }}>
            <span className="vc-serif" style={{ fontSize: 18, fontStyle: 'italic',
                lineHeight: 1.35, letterSpacing: '-0.01em' }}>
              "If Hungary goes to Verstappen, the title flips to 48/52 overnight.
              <span style={{ color: T.cyan }}> One wet Saturday</span> is all it takes."
            </span>
            <div className="vc-mono" style={{ fontSize: 9, color: T.mid, marginTop: 8,
                letterSpacing: '0.14em' }}>
              — SENSITIVITY ANALYSIS · RUN 0847.3FE1
            </div>
          </div>
        </div>

        {/* RIGHT — circuit forecast */}
        <div style={{ borderLeft: `1px solid ${T.rule}`, padding: '22px 26px',
            display: 'flex', flexDirection: 'column', gap: 18, overflow: 'hidden' }}>

          <div>
            <Eyebrow>constructors</Eyebrow>
            <div className="vc-serif" style={{ fontSize: 20, marginTop: 2,
                fontStyle: 'italic', letterSpacing: '-0.01em' }}>
              Into the papaya era.
            </div>
            <div style={{ marginTop: 12 }}>
              {[['McLaren',0.612],['Red Bull',0.214],['Ferrari',0.118],['Mercedes',0.042]].map(([t,p]) => (
                <div key={t} style={{ display: 'grid', gridTemplateColumns: '1fr 50px',
                    gap: 10, padding: '7px 0', alignItems: 'center',
                    borderBottom: `1px solid ${T.rule}` }}>
                  <div>
                    <div style={{ fontSize: 12 }}>{t}</div>
                    <div style={{ height: 3, background: T.sunk, marginTop: 4, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${p*100}%`, background: TEAM_COLORS[t] }} />
                    </div>
                  </div>
                  <span className="vc-serif" style={{ fontSize: 20, textAlign: 'right',
                      letterSpacing: '-0.02em', color: p > 0.5 ? T.cyan : T.ink }}>
                    {(p*100).toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>next twelve</Eyebrow>
            <div className="vc-serif" style={{ fontSize: 20, marginTop: 2,
                fontStyle: 'italic', letterSpacing: '-0.01em' }}>
              Predicted winners.
            </div>
            <div style={{ marginTop: 10 }}>
              {RACES.filter(r => !r.done).slice(0, 9).map(r => (
                <div key={r.r} style={{ display: 'grid',
                    gridTemplateColumns: '24px 1fr auto', gap: 10,
                    padding: '7px 0', alignItems: 'baseline',
                    borderBottom: `1px solid ${T.rule}` }}>
                  <span className="vc-mono" style={{ fontSize: 10, color: T.faint,
                      letterSpacing: '0.08em' }}>R{r.r}</span>
                  <div>
                    <span style={{ fontSize: 12 }}>{r.name}</span>
                    <span className="vc-mono" style={{ fontSize: 10, color: T.mid,
                        marginLeft: 6, letterSpacing: '0.06em' }}>
                      · {Math.round(r.conf*100)}%
                    </span>
                  </div>
                  <span className="vc-serif" style={{ fontSize: 16, fontStyle: 'italic',
                      color: T.cyan, letterSpacing: '-0.01em' }}>
                    {r.pred}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.VectorSimulate = VectorSimulate;
