import { create } from 'zustand'
import type { Transaction } from '@/types'

export type TxDraftDefaults = Partial<Omit<Transaction, 'id' | 'createdAt'>>

interface UIState {
  txDialogOpen: boolean
  txDefaults: TxDraftDefaults
  /** Doluysa mevcut işlem düzenlenir */
  txEditId: string | null
  openTxDialog: (defaults?: TxDraftDefaults, editId?: string) => void
  closeTxDialog: () => void
}

/** Kalıcı olmayan arayüz durumu (modal açık/kapalı vb.) */
export const useUIStore = create<UIState>()((set) => ({
  txDialogOpen: false,
  txDefaults: {},
  txEditId: null,
  openTxDialog: (defaults = {}, editId) => set({ txDialogOpen: true, txDefaults: defaults, txEditId: editId ?? null }),
  closeTxDialog: () => set({ txDialogOpen: false }),
}))

// ─── Onay penceresi (native confirm() yerine; gömülü görünümlerde de çalışır) ───
interface ConfirmState {
  message: string | null
  onYes: (() => void) | null
  ask: (message: string, onYes: () => void) => void
  close: () => void
}
export const useConfirmStore = create<ConfirmState>()((set) => ({
  message: null,
  onYes: null,
  ask: (message, onYes) => set({ message, onYes }),
  close: () => set({ message: null, onYes: null }),
}))
export const askConfirm = (message: string, onYes: () => void) => useConfirmStore.getState().ask(message, onYes)
