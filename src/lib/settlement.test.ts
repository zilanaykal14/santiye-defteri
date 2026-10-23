import { describe, expect, it } from 'vitest'
import { allocate, parseTL } from './money'
import { settleAll, settleProject } from './settlement'
import { expectedRent, rentCell } from './rent'
import { buildSeed } from '@/data/seed'
import type { Lease, Project, Transaction } from '@/types'

const tl = (n: number) => n * 100
const project: Project = {
  id: 'A',
  name: 'Proje A',
  location: '',
  status: 'devam',
  startDate: '2026-01-01',
  progress: 0,
  shares: [
    { partnerId: 'kardes', shareBps: 5000 },
    { partnerId: 'o1', shareBps: 3000 },
    { partnerId: 'o2', shareBps: 2000 },
  ],
  budget: { malzeme: 0, taseron: 0, resmi: 0, lojistik: 0 },
}
let n = 0
const tx = (t: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  kind: 'gider',
  date: '2026-02-01',
  description: '',
  amount: 0,
  payer: { kind: 'kasa' },
  projectId: 'A',
  createdAt: `2026-02-01T00:00:0${n % 10}Z`,
  ...t,
})
const bal = (s: ReturnType<typeof settleProject>, id: string) => s.balances.find((b) => b.partnerId === id)!

describe('allocate', () => {
  it('kuruşu kaybetmeden dağıtır', () => {
    expect(allocate(10001, [5000, 3000, 2000])).toEqual([5001, 3000, 2000])
    expect(allocate(100, [3333, 3333, 3334]).reduce((a, b) => a + b)).toBe(100)
    expect(allocate(-10001, [5000, 3000, 2000])).toEqual([-5001, -3000, -2000])
  })
})

describe('mahsuplaşma motoru', () => {
  it('Kardeşim cebinden 100.000 TL demir öderse ortaklar hisseleri kadar borçlanır', () => {
    const s = settleProject(project, [
      tx({ scope: 'ortak', amount: tl(100_000), payer: { kind: 'ortak', partnerId: 'kardes' } }),
    ])
    expect(bal(s, 'kardes').net).toBe(tl(50_000))
    expect(bal(s, 'o1').net).toBe(tl(-30_000))
    expect(bal(s, 'o2').net).toBe(tl(-20_000))
    expect(s.transfers).toEqual([
      { fromPartnerId: 'o1', toPartnerId: 'kardes', amount: tl(30_000) },
      { fromPartnerId: 'o2', toPartnerId: 'kardes', amount: tl(20_000) },
    ])
  })

  it('kasadan ödenen ortak gider, eşit sermaye koyulduysa kimseyi borçlandırmaz', () => {
    const s = settleProject(project, [
      tx({ kind: 'sermaye', amount: tl(500_000), payer: { kind: 'ortak', partnerId: 'kardes' } }),
      tx({ kind: 'sermaye', amount: tl(300_000), payer: { kind: 'ortak', partnerId: 'o1' } }),
      tx({ kind: 'sermaye', amount: tl(200_000), payer: { kind: 'ortak', partnerId: 'o2' } }),
      tx({ scope: 'ortak', amount: tl(400_000), payer: { kind: 'kasa' } }),
    ])
    expect(s.kasaBalance).toBe(tl(600_000))
    expect(s.balances.every((b) => b.net === 0)).toBe(true)
    expect(s.transfers).toHaveLength(0)
  })

  it('eksik sermaye koyan ortak borçlu görünür', () => {
    const s = settleProject(project, [
      tx({ kind: 'sermaye', amount: tl(500_000), payer: { kind: 'ortak', partnerId: 'kardes' } }),
      tx({ kind: 'sermaye', amount: tl(300_000), payer: { kind: 'ortak', partnerId: 'o1' } }),
      tx({ scope: 'ortak', amount: tl(800_000), payer: { kind: 'kasa' } }),
    ])
    expect(s.kasaBalance).toBe(0)
    expect(bal(s, 'o2').net).toBe(tl(-160_000))
    expect(s.balances.reduce((a, b) => a + b.net, 0)).toBe(0)
  })

  it('şahsi gider kasadan ödenirse sahibi tamamını borçlanır; kendi cebinden ise etkisiz', () => {
    const s = settleProject(project, [
      tx({ scope: 'sahsi', amount: tl(10_000), payer: { kind: 'kasa' }, ownerPartnerId: 'kardes' }),
      tx({ scope: 'sahsi', amount: tl(99_999), payer: { kind: 'ortak', partnerId: 'o1' } }),
    ])
    expect(s.kasaBalance).toBe(tl(-10_000))
    // −10.000 kasa açığı hisseye göre dağılır: kardeş −5.000 pay → net = −10.000 − (−5.000)
    expect(bal(s, 'kardes').net).toBe(tl(-5_000))
    expect(bal(s, 'o1').net).toBe(tl(3_000))
    expect(bal(s, 'o2').net).toBe(tl(2_000))
  })

  it('ortak geliri cebine alan ortak, diğerlerine hisselerini borçlanır', () => {
    const s = settleProject(project, [
      tx({ kind: 'gelir', scope: 'ortak', amount: tl(1_000_000), payer: { kind: 'ortak', partnerId: 'kardes' } }),
    ])
    expect(bal(s, 'kardes').net).toBe(tl(-500_000))
    expect(bal(s, 'o1').net).toBe(tl(300_000))
  })

  it('ortaklar arası ödeme borcu kapatır', () => {
    const s = settleProject(project, [
      tx({ scope: 'ortak', amount: tl(100_000), payer: { kind: 'ortak', partnerId: 'kardes' } }),
      tx({ kind: 'mahsup', amount: tl(30_000), payer: { kind: 'ortak', partnerId: 'o1' }, receiverPartnerId: 'kardes' }),
    ])
    expect(bal(s, 'o1').net).toBe(0)
    expect(bal(s, 'kardes').net).toBe(tl(20_000))
  })

  it('demo verisinde her proje sıfır toplamlı', () => {
    const seed = buildSeed(new Date('2026-10-22T12:00:00'))
    const all = settleAll(seed.projects, seed.transactions)
    for (const p of all.perProject) {
      expect(p.shareError).toBeUndefined()
      expect(p.balances.reduce((a, b) => a + b.net, 0)).toBe(0)
      const sumPaidMinusShare = p.balances.reduce((a, b) => a + b.paid - b.share, 0)
      expect(sumPaidMinusShare).toBe(p.kasaBalance)
    }
    expect(all.totals.reduce((a, b) => a + b.net, 0)).toBe(0)
  })
})

describe('kira', () => {
  const lease: Lease = {
    id: 'l', unitId: 'u', tenantId: 't', startDate: '2025-03-01', endDate: '2027-02-28',
    monthlyRent: tl(10_000), deposit: 0, dueDay: 5, increasePeriod: 'yillik', increaseRateBps: 3000, active: true,
  }
  it('yıllık artış uygular', () => {
    expect(expectedRent(lease, '2026-02')).toBe(tl(10_000))
    expect(expectedRent(lease, '2026-03')).toBe(tl(13_000))
  })
  it('durumları doğru hesaplar', () => {
    expect(rentCell(lease, '2026-10', [], '2026-10-22')!.status).toBe('gecikmede')
    expect(rentCell(lease, '2026-10', [], '2026-10-02')!.status).toBe('yaklasan')
    expect(rentCell(lease, '2026-10', [{ id: 'x', leaseId: 'l', month: '2026-10', paidDate: '2026-10-05', amount: tl(5000) }], '2026-10-22')!.status).toBe('kismi')
  })
})

describe('parseTL', () => {
  it('Türkçe biçimleri anlar', () => {
    expect(parseTL('100.000')).toBe(10_000_000)
    expect(parseTL('1.250.000,50')).toBe(125_000_050)
    expect(parseTL('2500,5')).toBe(250_050)
    expect(parseTL('abc')).toBeNull()
  })
})
