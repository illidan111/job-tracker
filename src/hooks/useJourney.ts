import { createContext, useContext } from 'react'
import type { Journey } from '../domain/journey'
export const JourneyContext = createContext<{ data?: Journey; error?: string; loading: boolean; retry: () => void }>({ loading: true, retry: () => {} })
export const useJourney = () => useContext(JourneyContext)
