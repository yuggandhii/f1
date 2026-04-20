import { useState } from 'react'
import { Map, Mail, ArrowRight } from 'lucide-react'

const RED = '#EE3F2C'

export default function RaceReplay() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light'

  function handleSubscribe() {
    if (!email.trim()) return
    const list = JSON.parse(localStorage.getItem('f1sim:notify') ?? '[]') as string[]
    if (!list.includes(email)) list.push(email)
    localStorage.setItem('f1sim:notify', JSON.stringify(list))
    setSubscribed(true)
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: isDark ? 'bg-shift 8s ease-in-out infinite' : 'bg-shift-light 8s ease-in-out infinite',
      position: 'relative',
    }}>
      <div className="dot-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '580px', padding: '40px 24px', animation: 'fade-up 0.5s ease-out' }}>

        {/* Icon with pulse ring */}
        <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '32px' }}>
          <div style={{
            position: 'absolute', inset: '-20px', borderRadius: '50%',
            border: `1px solid ${RED}`, animation: 'pulse-ring 2s ease-out infinite', opacity: 0,
          }} />
          <div style={{
            position: 'absolute', inset: '-20px', borderRadius: '50%',
            border: `1px solid ${RED}`, animation: 'pulse-ring 2s ease-out 1s infinite', opacity: 0,
          }} />
          <div style={{
            width: '80px', height: '80px',
            background: 'rgba(238,63,44,0.08)', border: `1px solid rgba(238,63,44,0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Map size={36} color={RED} />
          </div>
        </div>

        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: RED, textTransform: 'uppercase', marginBottom: '14px' }}>
          Feature in Development
        </p>

        <h1 style={{ fontSize: '36px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.05, marginBottom: '20px' }}>
          2D Race<br />Replay
        </h1>

        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: '32px' }}>
          Watch any simulated race unfold lap by lap.
          20 driver dots racing around SVG circuit maps.
          Safety cars, pit stops, overtakes — all animated in real time.
        </p>

        {/* Progress */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Development Progress
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: RED }}>40%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: '40%',
              backgroundImage: `repeating-linear-gradient(-45deg, ${RED} 0px, ${RED} 6px, #c42b1a 6px, #c42b1a 12px)`,
              backgroundSize: '30px 100%',
              animation: 'racing-stripe 0.6s linear infinite',
            }} />
          </div>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '32px', textAlign: 'left' }}>
          {[
            'SVG circuit maps for all 24 circuits',
            '20 animated driver dots on track',
            'Real-time timing tower',
            'Safety car & pit stop events',
            'Speed control: 1× to 50×',
            'Pick any of 10,000 simulated races',
          ].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: RED, flexShrink: 0, marginTop: '6px' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Notify */}
        {!subscribed ? (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Get notified when ready
            </p>
            <div style={{ display: 'flex', gap: '8px', maxWidth: '380px', margin: '0 auto' }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubscribe() }}
                placeholder="your@email.com"
                style={{
                  flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)', padding: '10px 14px', fontSize: '13px',
                  fontFamily: 'Rubik, sans-serif', outline: 'none',
                }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = RED }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--glass-border)' }}
              />
              <button
                onClick={handleSubscribe}
                style={{
                  background: RED, border: 'none', cursor: 'pointer', padding: '10px 18px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', fontWeight: 700, color: '#fff',
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Rubik, sans-serif',
                }}
              >
                <Mail size={13} />
                Notify Me
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>
            <ArrowRight size={14} />
            We'll notify you at {email} when 2D Race goes live!
          </div>
        )}
      </div>
    </div>
  )
}
