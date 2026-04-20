import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SeasonProvider } from './contexts/SeasonContext'
import AppLayout from './layouts/AppLayout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Simulate from './pages/Simulate'
import WhatIf from './pages/WhatIf'
import RaceReplay from './pages/RaceReplay'
import Game from './pages/Game'
import DriverDetail from './pages/DriverDetail'

export default function App() {
  return (
    <SeasonProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/simulate" element={<Simulate />} />
            <Route path="/what-if" element={<WhatIf />} />
            <Route path="/race-replay" element={<RaceReplay />} />
            <Route path="/game" element={<Game />} />
            <Route path="/drivers/:id" element={<DriverDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SeasonProvider>
  )
}
