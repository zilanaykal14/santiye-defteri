import type { Bps, Kurus } from '@/types'

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const tlCompact = new Intl.NumberFormat('tr-TR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Kuruş -> "₺100.000" */
export function formatTL(k: Kurus): string {
  return tl.format(k / 100)
}

/** Kuruş -> "1,2 Mn ₺" (grafik eksenleri için) */
export function formatTLCompact(k: Kurus): string {
  return `${tlCompact.format(k / 100)} ₺`
}

/** İşaretli gösterim: +₺5.000 / −₺5.000 */
export function formatSigned(k: Kurus): string {
  if (k === 0) return formatTL(0)
  return `${k > 0 ? '+' : '−'}${formatTL(Math.abs(k))}`
}

/**
 * Kullanıcı girdisini kuruşa çevirir. Türkçe biçimleri kabul eder:
 * "100.000", "100.000,50", "100000.5", "1.250.000,00"
 */
export function parseTL(input: string): Kurus | null {
  const s = input.trim().replace(/[₺\s]/g, '')
  if (!s) return null
  let normalized: string
  if (s.includes(',')) {
    // Türkçe: nokta binlik, virgül ondalık
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else {
    const dots = s.split('.').length - 1
    // "100.000" (tek nokta + 3 hane) veya birden çok nokta => binlik ayırıcı
    normalized = dots > 1 || /\.\d{3}$/.test(s) ? s.replace(/\./g, '') : s
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

export const bpsToPct = (b: Bps) => b / 100
export const pctToBps = (p: number) => Math.round(p * 100)

/**
 * Bir tutarı hisse oranlarına göre KURUŞU KURUŞUNA dağıtır (en büyük kalan yöntemi).
 * Dağıtılan parçaların toplamı her zaman `amount`a eşittir; yuvarlama kaçağı olmaz.
 *   allocate(10001, [5000, 3000, 2000]) -> [5001, 3000, 2000]
 */
export function allocate(amount: Kurus, weights: Bps[]): Kurus[] {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total === 0) return weights.map(() => 0)
  const sign = amount < 0 ? -1 : 1
  const abs = Math.abs(amount)
  const raw = weights.map((w) => (abs * w) / total)
  const floors = raw.map(Math.floor)
  let remainder = abs - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (remainder <= 0) break
    floors[i] += 1
    remainder -= 1
  }
  return floors.map((f) => f * sign)
}

/** Matris hücreleri için kısa gösterim: 18.500 TL -> "18,5b" */
export function formatThousands(k: Kurus): string {
  const tlv = k / 100
  if (Math.abs(tlv) < 1000) return tlv.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
  return `${(tlv / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}b`
}
