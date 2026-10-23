/**
 * MAHSUPLAŞMA (SETTLEMENT) MOTORU
 * ===============================
 * Saf fonksiyonlar — UI ve depolamadan bağımsız, birim testli (settlement.test.ts).
 *
 * Model: Her proje için ortaklar + "Ortak Kasa" vardır.
 *  - credit (alacak): ortağın ortaklık adına cebinden çıkan para
 *  - debit  (borç):   ortağın hissesine düşen yük
 *
 * İşlem etkileri:
 *  | İşlem                              | Ödeyen ortak / kasa      | Diğer etki                       |
 *  |------------------------------------|--------------------------|----------------------------------|
 *  | Ortak gider, ortak X ödedi         | X: +tutar alacak         | Herkes: hissesi kadar borç       |
 *  | Ortak gider, kasadan ödendi        | Kasa: −tutar             | Herkes: hissesi kadar borç       |
 *  | Şahsi gider, kasadan ödendi        | Kasa: −tutar             | Sahibi: tutarın tamamı borç      |
 *  | Şahsi gider, ortak X ödedi (≠sahip)| X: +tutar alacak         | Sahibi: tutarın tamamı borç      |
 *  | Şahsi gider, sahibi kendisi ödedi  | — (mahsuplaşmaya girmez) |                                  |
 *  | Ortak gelir, kasaya girdi          | Kasa: +tutar             | Herkes: hissesi kadar alacak     |
 *  | Ortak gelir, ortak X tahsil etti   | X: tutar kadar borç      | Herkes: hissesi kadar alacak     |
 *  | Sermaye: X kasaya koydu            | X: +tutar alacak         | Kasa: +tutar                     |
 *  | Mahsup: X, Y'ye ödedi              | X: +tutar alacak         | Y: tutar kadar borç              |
 *
 * Değişmez (invariant): Σ(ortak net) = kasa bakiyesi. Kasadaki nakit hisse oranında
 * ortaklara ait sayılır; "düzeltilmiş net" = net − kasa payı ve Σ = 0 olur.
 * Böylece "kim kime ne kadar ödemeli" sıfır toplamlı bir problem olur.
 */
import { allocate } from './money'
import type {
  ID,
  Kurus,
  LedgerEntry,
  PartnerBalance,
  Project,
  ProjectSettlement,
  SettlementTransfer,
  Transaction,
} from '@/types'

export function validateShares(project: Project): string | undefined {
  const total = project.shares.reduce((a, s) => a + s.shareBps, 0)
  if (project.shares.length === 0) return 'Projeye ortak tanımlanmamış.'
  if (total !== 10000) return `Hisse toplamı %${total / 100} — %100 olmalı.`
  return undefined
}

interface Effect {
  entries: LedgerEntry[]
  kasaDelta: Kurus
}

/** Tek bir işlemin ortaklara ve kasaya etkisi */
export function transactionEffect(tx: Transaction, project: Project): Effect {
  const entries: LedgerEntry[] = []
  let kasaDelta = 0
  const base = {
    transactionId: tx.id,
    projectId: project.id,
    date: tx.date,
    description: tx.description,
  }
  const credit = (partnerId: ID, amount: Kurus) =>
    amount !== 0 && entries.push({ ...base, partnerId, credit: amount, debit: 0 })
  const debit = (partnerId: ID, amount: Kurus) =>
    amount !== 0 && entries.push({ ...base, partnerId, credit: 0, debit: amount })
  const byShare = (amount: Kurus, fn: (id: ID, a: Kurus) => void) => {
    const parts = allocate(amount, project.shares.map((s) => s.shareBps))
    project.shares.forEach((s, i) => fn(s.partnerId, parts[i]))
  }
  const payerId = tx.payer.kind === 'ortak' ? tx.payer.partnerId : null

  switch (tx.kind) {
    case 'gider': {
      if (tx.scope === 'ortak') {
        if (payerId) credit(payerId, tx.amount)
        else kasaDelta -= tx.amount
        byShare(tx.amount, debit)
      } else {
        const owner = tx.ownerPartnerId ?? payerId
        if (!owner || owner === payerId) break // kendi cebinden kendi gideri: etkisiz
        if (payerId) credit(payerId, tx.amount)
        else kasaDelta -= tx.amount
        debit(owner, tx.amount)
      }
      break
    }
    case 'gelir': {
      if (tx.scope !== 'ortak') break
      if (payerId) debit(payerId, tx.amount)
      else kasaDelta += tx.amount
      byShare(tx.amount, credit)
      break
    }
    case 'sermaye': {
      if (payerId) {
        credit(payerId, tx.amount)
        kasaDelta += tx.amount
      }
      break
    }
    case 'mahsup': {
      if (payerId && tx.receiverPartnerId) {
        credit(payerId, tx.amount)
        debit(tx.receiverPartnerId, tx.amount)
      }
      break
    }
  }
  return { entries, kasaDelta }
}

/** Projeye ait tüm defter satırları (kronolojik) */
export function projectLedger(project: Project, txs: Transaction[]): LedgerEntry[] {
  return txs
    .filter((t) => t.projectId === project.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .flatMap((t) => transactionEffect(t, project).entries)
}

/**
 * Borçlular -> alacaklılar arasında en az sayıda transferle mahsuplaşma (greedy).
 * Girdi: düzeltilmiş net bakiyeler (Σ = 0).
 */
export function minimizeTransfers(nets: Map<ID, Kurus>): SettlementTransfer[] {
  const creditors = [...nets].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }))
  const debtors = [...nets].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }))
  creditors.sort((a, b) => b.v - a.v)
  debtors.sort((a, b) => b.v - a.v)
  const out: SettlementTransfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v)
    if (amt > 0) out.push({ fromPartnerId: debtors[i].id, toPartnerId: creditors[j].id, amount: amt })
    debtors[i].v -= amt
    creditors[j].v -= amt
    if (debtors[i].v === 0) i++
    if (creditors[j].v === 0) j++
  }
  return out
}

export function settleProject(project: Project, txs: Transaction[]): ProjectSettlement {
  const shareError = validateShares(project)
  let kasaBalance = 0
  const paid = new Map<ID, Kurus>()
  const share = new Map<ID, Kurus>()
  for (const s of project.shares) {
    paid.set(s.partnerId, 0)
    share.set(s.partnerId, 0)
  }
  for (const tx of txs) {
    if (tx.projectId !== project.id) continue
    const eff = transactionEffect(tx, project)
    kasaBalance += eff.kasaDelta
    for (const e of eff.entries) {
      paid.set(e.partnerId, (paid.get(e.partnerId) ?? 0) + e.credit)
      share.set(e.partnerId, (share.get(e.partnerId) ?? 0) + e.debit)
    }
  }

  const ids = [...paid.keys()]
  const weights = ids.map((id) => project.shares.find((s) => s.partnerId === id)?.shareBps ?? 0)
  const kasaParts = allocate(kasaBalance, weights)

  const balances: PartnerBalance[] = ids.map((id, i) => {
    const p = paid.get(id) ?? 0
    const sh = share.get(id) ?? 0
    return { partnerId: id, paid: p, share: sh, kasaShare: kasaParts[i], net: p - sh - kasaParts[i] }
  })
  const transfers = minimizeTransfers(new Map(balances.map((b) => [b.partnerId, b.net])))
  return { projectId: project.id, kasaBalance, balances, transfers, shareError }
}

/** Tüm projeler birleşik: kişi bazında toplam net + en az transferle genel mahsup */
export function settleAll(projects: Project[], txs: Transaction[]) {
  const perProject = projects.map((p) => settleProject(p, txs))
  const totals = new Map<ID, PartnerBalance>()
  for (const ps of perProject) {
    for (const b of ps.balances) {
      const t = totals.get(b.partnerId) ?? { partnerId: b.partnerId, paid: 0, share: 0, kasaShare: 0, net: 0 }
      t.paid += b.paid
      t.share += b.share
      t.kasaShare += b.kasaShare
      t.net += b.net
      totals.set(b.partnerId, t)
    }
  }
  const nets = new Map([...totals].map(([id, b]) => [id, b.net]))
  return {
    perProject,
    totals: [...totals.values()],
    transfers: minimizeTransfers(nets),
    kasaTotal: perProject.reduce((a, p) => a + p.kasaBalance, 0),
  }
}
