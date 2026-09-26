import { create } from 'zustand'
import type { Status } from '../types/application'

interface UIState {
  editor: { id?: string; status: Status } | null
  openEditor: (id?: string, status?: Status) => void
  closeEditor: () => void
  toasts: { id: string; message: string }[]
  toast: (message: string) => void
  dismissToast: (id: string) => void
}

export const useUI = create<UIState>((set, get) => ({
  editor: null,
  openEditor: (id, status = 'APPLIED') => set({ editor: { id, status } }),
  closeEditor: () => set({ editor: null }),
  toasts: [],
  toast: message => {
    const id = crypto.randomUUID()
    set(state => ({ toasts: [...state.toasts.slice(-2), { id, message }] }))
    setTimeout(() => get().dismissToast(id), 5000)
  },
  dismissToast: id => set(state => ({ toasts: state.toasts.filter(toast => toast.id !== id) })),
}))
