import { useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { settleAll } from '@/lib/settlement'
import { monthOf, todayISO } from '@/lib/dates'

/** Merkezi türetilmiş veri: mahsuplaşma sonuçları ve tarih bağlamı (memoize edilmiş) */
export function useSettlement() {
  const projects = useAppStore((s) => s.projects)
  const transactions = useAppStore((s) => s.transactions)
  return useMemo(() => settleAll(projects, transactions), [projects, transactions])
}

export function useToday() {
  return useMemo(() => {
    const today = todayISO()
    return { today, month: monthOf(today) }
  }, [])
}
