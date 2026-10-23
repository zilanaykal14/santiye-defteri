import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

let seq = 0
export const useToastStore = create<{ toasts: Toast[]; dismiss: (id: number) => void }>()((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Ekranın altında kısa bildirim gösterir */
export function notify(text: string, tone: Toast['tone'] = 'info') {
  const id = ++seq
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }))
  setTimeout(() => useToastStore.getState().dismiss(id), tone === 'error' ? 7000 : 3500)
}
