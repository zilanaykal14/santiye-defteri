/**
 * BİLDİRİMLER
 * Uygulama içi bildirim listesi: geciken / kısmi / yaklaşan kiralar, biten sözleşmeler
 * ve vadesi gelen hatırlatıcılar. Saf fonksiyon — notifications.test.ts ile test edilir.
 */
import { addDays, dayDiff, formatDate, monthLabel, monthOf } from './dates'
import { overdueRents, rentCell } from './rent'
import { formatTL } from './money'
import type { ISODate, Lease, Reminder, RentPayment, Tenant, Unit } from '@/types'

export type NoticeTone = 'negative' | 'warning' | 'info'

export interface Notice {
  id: string
  tone: NoticeTone
  kind: 'kira' | 'sozlesme' | 'hatirlatici'
  title: string
  detail: string
  /** Dokununca gidilecek sayfa */
  to: string
  /** Sıralama: önce en acil */
  priority: number
}

export const LEASE_END_WARN_DAYS = 30
export const REMINDER_SOON_DAYS = 3

export function buildNotices(input: {
  today: ISODate
  leases: Lease[]
  rentPayments: RentPayment[]
  tenants: Tenant[]
  units: Unit[]
  reminders: Reminder[]
  canSeeRentals: boolean
  isAdmin: boolean
}): Notice[] {
  const { today, leases, rentPayments, tenants, units, reminders } = input
  const out: Notice[] = []
  const who = (l: Lease) => {
    const t = tenants.find((x) => x.id === l.tenantId)?.name ?? 'Kiracı'
    const u = units.find((x) => x.id === l.unitId)?.label
    return u ? `${t} (${u})` : t
  }

  if (input.canSeeRentals) {
    const active = leases.filter((l) => l.active)
    // Geciken ve kısmi ödenmiş kiralar
    for (const c of overdueRents(active, rentPayments, today)) {
      const l = active.find((x) => x.id === c.leaseId)!
      const remaining = c.expected - c.paid
      out.push({
        id: `kira-${c.leaseId}-${c.month}`,
        tone: 'negative',
        kind: 'kira',
        title: c.paid > 0 ? `Kira eksik ödendi: ${who(l)}` : `Kira ödenmedi: ${who(l)}`,
        detail: `${monthLabel(c.month, true)} · ${c.daysLate} gün gecikti · kalan ${formatTL(remaining)}`,
        to: '/kiracilar',
        priority: 1000 + c.daysLate,
      })
    }
    // Vadesi yaklaşan (bu ay, henüz gecikmemiş)
    const month = monthOf(today)
    for (const l of active) {
      const c = rentCell(l, month, rentPayments, today)
      if (c?.status !== 'yaklasan') continue
      const days = dayDiff(today, c.dueDate)
      out.push({
        id: `yaklasan-${l.id}-${month}`,
        tone: 'info',
        kind: 'kira',
        title: `Kira günü yaklaşıyor: ${who(l)}`,
        detail: `${days === 0 ? 'Bugün' : `${days} gün sonra`} (${formatDate(c.dueDate)}) · ${formatTL(c.expected)}`,
        to: '/kiracilar',
        priority: 300 - days,
      })
    }
    // Bitmek üzere olan sözleşmeler
    for (const l of active) {
      const left = dayDiff(today, l.endDate)
      if (left < 0 || left > LEASE_END_WARN_DAYS) continue
      out.push({
        id: `sozlesme-${l.id}`,
        tone: 'warning',
        kind: 'sozlesme',
        title: `Sözleşme bitiyor: ${who(l)}`,
        detail: `${left === 0 ? 'Bugün' : `${left} gün sonra`} (${formatDate(l.endDate)})`,
        to: '/kiracilar',
        priority: 200 - left,
      })
    }
  }

  if (input.isAdmin) {
    const soon = addDays(today, REMINDER_SOON_DAYS)
    for (const r of reminders) {
      if (r.done || !r.dueDate || r.dueDate > soon) continue
      const diff = dayDiff(today, r.dueDate)
      out.push({
        id: `hatirlatici-${r.id}`,
        tone: diff < 0 ? 'negative' : diff === 0 ? 'warning' : 'info',
        kind: 'hatirlatici',
        title: r.text,
        detail: diff < 0 ? `${-diff} gün geçti (${formatDate(r.dueDate)})` : diff === 0 ? 'Bugün' : `${diff} gün sonra (${formatDate(r.dueDate)})`,
        to: '/hatirlaticilar',
        priority: diff <= 0 ? 900 - diff : 250 - diff,
      })
    }
  }

  return out.sort((a, b) => b.priority - a.priority)
}

/** Kırmızı rozet sayısı: acil olanlar (gecikmiş kira, bugün/geçmiş hatırlatıcı, bitmek üzere sözleşme) */
export const urgentCount = (list: Notice[]) => list.filter((n) => n.tone !== 'info').length
