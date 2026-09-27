import { create } from 'zustand'

export const useQueryRevision = create<{ revision: number; invalidate: () => void }>(set => ({ revision: 0, invalidate: () => set(state => ({ revision: state.revision + 1 })) }))
