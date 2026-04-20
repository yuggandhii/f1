import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface SeasonContextValue {
  season: number
  setSeason: (s: number) => void
}

const SeasonContext = createContext<SeasonContextValue>({ season: 2026, setSeason: () => {} })

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [season, setSeason] = useState<number>(() => {
    const stored = localStorage.getItem('f1sim:season')
    return stored ? parseInt(stored, 10) : 2026
  })

  useEffect(() => {
    localStorage.setItem('f1sim:season', String(season))
  }, [season])

  return <SeasonContext.Provider value={{ season, setSeason }}>{children}</SeasonContext.Provider>
}

export function useSeason() {
  return useContext(SeasonContext)
}
