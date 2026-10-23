/**
 * KİRA TAHSİLAT TAKVİMİ
 * Sözleşmeden beklenen kira (artış dahil) ve yapılan ödemelerden ay bazında durum üretir.
 */
import { addDays, dayDiff, dueDateOf, monthDiff, monthOf } from './dates'
import type { ISODate, Kurus, Lease, MonthKey, RentPayment, RentScheduleCell, RentStatus } from '@/types'

/** Vadeye bu kadar gün kala "yaklaşan" sayılır */
export const UPCOMING_WINDOW_DAYS = 5

export function leaseCoversMonth(lease: Lease, m: MonthKey): boolean {
  return monthOf(lease.startDate) <= m && m <= monthOf(lease.endDate)
}

/**
 * O ay için beklenen kira. Her artış periyodunda bileşik artış uygulanır,
 * tam TL'ye yuvarlanır (Türkiye pratiği).
 */
export function expectedRent(lease: Lease, m: MonthKey): Kurus {
  const period = lease.increasePeriod === 'yillik' ? 12 : 6
  const elapsed = Math.max(0, monthDiff(monthOf(lease.startDate), m))
  const steps = Math.floor(elapsed / period)
  const factor = Math.pow(1 + lease.increaseRateBps / 10000, steps)
  return Math.round((lease.monthlyRent * factor) / 100) * 100
}

export function rentCell(
  lease: Lease,
  m: MonthKey,
  payments: RentPayment[],
  today: ISODate,
): RentScheduleCell | null {
  if (!leaseCoversMonth(lease, m)) return null
  const expected = expectedRent(lease, m)
  const paid = payments
    .filter((p) => p.leaseId === lease.id && p.month === m)
    .reduce((a, p) => a + p.amount, 0)
  const dueDate = dueDateOf(m, lease.dueDay)
  const overdueDays = dayDiff(dueDate, today)
  let status: RentStatus
  if (paid >= expected) status = 'odendi'
  else if (paid > 0) status = 'kismi'
  else if (overdueDays > 0) status = 'gecikmede'
  else if (addDays(today, UPCOMING_WINDOW_DAYS) >= dueDate) status = 'yaklasan'
  else status = 'bekliyor'
  return {
    leaseId: lease.id,
    month: m,
    dueDate,
    expected,
    paid,
    status,
    daysLate: status === 'odendi' ? 0 : Math.max(0, overdueDays),
  }
}

/** Bugüne kadar vadesi geçmiş ve tamamı ödenmemiş tüm kira kalemleri */
export function overdueRents(leases: Lease[], payments: RentPayment[], today: ISODate): RentScheduleCell[] {
  const out: RentScheduleCell[] = []
  const current = monthOf(today)
  for (const lease of leases) {
    let m = monthOf(lease.startDate)
    while (m <= current && leaseCoversMonth(lease, m)) {
      const cell = rentCell(lease, m, payments, today)
      if (cell && cell.daysLate > 0 && cell.paid < cell.expected) out.push(cell)
      const [y, mm] = m.split('-').map(Number)
      m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`
    }
  }
  return out.sort((a, b) => b.daysLate - a.daysLate)
}

export const RENT_STATUS_LABEL: Record<RentStatus, string> = {
  odendi: 'Ödendi',
  kismi: 'Kısmi',
  gecikmede: 'Gecikmede',
  yaklasan: 'Vadesi yakın',
  bekliyor: 'Bekliyor',
}
