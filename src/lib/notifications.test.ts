import { describe, expect, it } from 'vitest'
import { buildNotices, urgentCount } from './notifications'
import type { Lease, Reminder } from '@/types'

const tl = (n: number) => n * 100
const lease = (over: Partial<Lease> = {}): Lease => ({
  id: 'l1', unitId: 'u1', tenantId: 't1', startDate: '2026-01-01', endDate: '2027-12-31',
  monthlyRent: tl(15000), deposit: 0, dueDay: 5, increasePeriod: 'yillik', increaseRateBps: 0, active: true, ...over,
})
const base = {
  today: '2026-11-11',
  leases: [lease()],
  rentPayments: [] as never[],
  tenants: [{ id: 't1', name: 'Ayşe Kaya' }],
  units: [{ id: 'u1', propertyId: 'p1', label: 'A-3' }],
  reminders: [] as Reminder[],
  canSeeRentals: true,
  isAdmin: true,
}

describe('bildirimler', () => {
  it('ödenmeyen kirayı gün sayısı ve kalan tutarla bildirir', () => {
    const list = buildNotices({ ...base, rentPayments: [] })
    // Ocak–Ekim ödendi sayılsın, sadece Kasım eksik
    const paid = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`, leaseId: 'l1', month: `2026-${String(i + 1).padStart(2, '0')}`, paidDate: '2026-01-01', amount: tl(15000),
    }))
    const only = buildNotices({ ...base, rentPayments: paid as never[] })
    expect(only).toHaveLength(1)
    expect(only[0].title).toBe('Kira ödenmedi: Ayşe Kaya (A-3)')
    expect(only[0].detail).toMatch(/6 gün gecikti/)
    expect(only[0].detail).toMatch(/15\.000/)
    expect(list.length).toBeGreaterThan(1) // hiç ödeme yoksa her ay ayrı bildirim
  })

  it('kısmi ödemeyi ayrı yazar', () => {
    const paid = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, leaseId: 'l1', month: `2026-${String(i + 1).padStart(2, '0')}`, paidDate: '2026-01-01', amount: tl(15000) }))
    paid.push({ id: 'k', leaseId: 'l1', month: '2026-11', paidDate: '2026-11-05', amount: tl(5000) })
    const [n] = buildNotices({ ...base, rentPayments: paid as never[] })
    expect(n.title).toMatch(/eksik ödendi/)
    expect(n.detail).toMatch(/10\.000/)
  })

  it('yaklaşan kira günü ve biten sözleşme uyarısı', () => {
    const list = buildNotices({ ...base, today: '2026-11-02', leases: [lease({ startDate: '2026-11-01', endDate: '2026-11-20' })] })
    expect(list.map((n) => n.kind).sort()).toEqual(['kira', 'sozlesme'])
    expect(list.find((n) => n.kind === 'kira')!.title).toMatch(/yaklaşıyor/)
  })

  it('kira yetkisi olmayan kira bildirimi görmez, yönetici olmayan hatırlatıcı görmez', () => {
    const reminders: Reminder[] = [{ id: 'r', text: 'Belediye', dueDate: '2026-11-11', done: false, createdAt: '' }]
    expect(buildNotices({ ...base, reminders, canSeeRentals: false, isAdmin: false })).toHaveLength(0)
    const adminOnly = buildNotices({ ...base, reminders, canSeeRentals: false, isAdmin: true })
    expect(adminOnly.map((n) => n.title)).toEqual(['Belediye'])
  })

  it('hatırlatıcı: geçmiş/bugün acil, 3 gün içi bilgi, uzak ve tamamlanmış gizli', () => {
    const reminders: Reminder[] = [
      { id: 'a', text: 'Geçmiş', dueDate: '2026-11-09', done: false, createdAt: '' },
      { id: 'b', text: 'Bugün', dueDate: '2026-11-11', done: false, createdAt: '' },
      { id: 'c', text: 'Yakın', dueDate: '2026-11-13', done: false, createdAt: '' },
      { id: 'd', text: 'Uzak', dueDate: '2026-12-30', done: false, createdAt: '' },
      { id: 'e', text: 'Bitti', dueDate: '2026-11-10', done: true, createdAt: '' },
      { id: 'f', text: 'Tarihsiz', done: false, createdAt: '' },
    ]
    const list = buildNotices({ ...base, leases: [], reminders })
    expect(list.map((n) => n.title)).toEqual(['Geçmiş', 'Bugün', 'Yakın'])
    expect(urgentCount(list)).toBe(2)
  })
})
