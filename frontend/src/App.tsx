import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'

function Placeholder({ title }: { title: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#000', color: '#fff', fontFamily: 'Rubik, sans-serif' }}
    >
      <div className="text-center">
        <div
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: '#EE3F2C' }}
        >
          Coming Soon
        </div>
        <h1 className="text-4xl font-black uppercase" style={{ letterSpacing: '-0.04em' }}>
          {title}
        </h1>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
        <Route path="/simulate" element={<Placeholder title="Simulation" />} />
        <Route path="/what-if" element={<Placeholder title="What-If Scenarios" />} />
      </Routes>
    </BrowserRouter>
  )
}
