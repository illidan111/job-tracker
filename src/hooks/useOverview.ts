import { createContext, useContext } from 'react'
import type { Overview } from '../domain/overview'
export const OverviewContext = createContext<{ data?: Overview; error?: string; loading: boolean; retry: () => void }>({ loading: true, retry: () => {} })
export const useOverview = () => useContext(OverviewContext)
