/** Dashboard ve raporlar için türetilmiş finansal metrikler (saf fonksiyonlar). */
import { lastMonths, monthOf } from './dates'
import { expectedRent, leaseCoversMonth } from './rent'
import { COST_CATEGORIES } from './labels'
import type { CostCategory, ID, ISODate, Kurus, Lease, MonthKey, Project, RentPayment, Transaction } from '@/types'

const sum = (xs: Kurus[]) => xs.reduce((a, b) => a + b, 0)

/** Projenin inşaat maliyeti = ortak giderler (şahsi giderler projeye yazılmaz) */
export function projectCostTxs(projectId: ID, txs: Transaction[]) {
  return txs.filter((t) => t.projectId === projectId && t.kind === 'gider' && t.scope === 'ortak')
}

export function projectActualByCategory(projectId: ID, txs: Transaction[]): Record<CostCategory, Kurus> {
  const out = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, Kurus>
  for (const t of projectCostTxs(projectId, txs)) {
    const c = (COST_CATEGORIES as string[]).includes(t.category ?? '') ? (t.category as CostCategory) : 'lojistik'
    out[c] += t.amount
  }
  return out
}

export function projectTotals(p: Project, txs: Transaction[]) {
  const actualByCat = projectActualByCategory(p.id, txs)
  const actual = sum(Object.values(actualByCat))
  const budget = sum(Object.values(p.budget))
  return { actualByCat, actual, budget, ratio: budget ? actual / budget : 0 }
}

/** Mülk/şahsi gider: mülk giderleri + birincil kişinin şahsi giderleri */
export function isPersonalOutflow(t: Transaction, primaryId: ID | undefined): boolean {
  if (t.kind !== 'gider') return false
  if (t.propertyId) return true
  if (t.scope === 'sahsi') {
    const owner = t.ownerPartnerId ?? (t.payer.kind === 'ortak' ? t.payer.partnerId : undefined)
    return owner === primaryId
  }
  return false
}

export interface MonthlyFlow {
  month: MonthKey
  rentExpected: Kurus
  rentCollected: Kurus
  outflow: Kurus
  net: Kurus
  construction: Kurus
}

export function monthlyFlows(
  current: MonthKey,
  n: number,
  leases: Lease[],
  payments: RentPayment[],
  txs: Transaction[],
  primaryId: ID | undefined,
): MonthlyFlow[] {
  return lastMonths(current, n).map((m) => {
    const rentExpected = sum(leases.filter((l) => leaseCoversMonth(l, m)).map((l) => expectedRent(l, m)))
    const rentCollected = sum(payments.filter((p) => monthOf(p.paidDate) === m).map((p) => p.amount))
    const outflow = sum(txs.filter((t) => monthOf(t.date) === m && isPersonalOutflow(t, primaryId)).map((t) => t.amount))
    const construction = sum(
      txs.filter((t) => monthOf(t.date) === m && t.kind === 'gider' && t.scope === 'ortak' && t.projectId).map((t) => t.amount),
    )
    return { month: m, rentExpected, rentCollected, outflow, net: rentCollected - outflow, construction }
  })
}

export function activeProjectsCost(projects: Project[], txs: Transaction[]): Kurus {
  return sum(
    projects
      .filter((p) => p.status === 'devam' || p.status === 'planlama' || p.status === 'beklemede')
      .map((p) => sum(projectCostTxs(p.id, txs).map((t) => t.amount))),
  )
}

export function spendingByProject(projects: Project[], txs: Transaction[]) {
  return projects
    .map((p) => ({ id: p.id, name: p.name, value: sum(projectCostTxs(p.id, txs).map((t) => t.amount)) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function leaseEndingSoon(leases: Lease[], today: ISODate, days = 60) {
  return leases.filter((l) => l.active && l.endDate >= today && l.endDate <= addDaysSafe(today, days))
}

function addDaysSafe(d: ISODate, n: number): ISODate {
  const [y, m, day] = d.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, day) + n * 86_400_000)
  return t.toISOString().slice(0, 10)
}
