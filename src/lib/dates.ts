import type { ISODate, MonthKey } from '@/types'

/** Saat dilimi kaymalarını önlemek için tarihleri yalnızca Y-A-G parçaları olarak işleriz. */

const pad = (n: number) => String(n).padStart(2, '0')

export function todayISO(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7)
}

export function parseMonth(m: MonthKey): { y: number; m: number } {
  const [y, mm] = m.split('-').map(Number)
  return { y, m: mm }
}

export function addMonths(m: MonthKey, n: number): MonthKey {
  const { y, m: mm } = parseMonth(m)
  const idx = y * 12 + (mm - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

/** a'dan b'ye kaç ay (b - a) */
export function monthDiff(a: MonthKey, b: MonthKey): number {
  const A = parseMonth(a)
  const B = parseMonth(b)
  return (B.y - A.y) * 12 + (B.m - A.m)
}

export function daysInMonth(m: MonthKey): number {
  const { y, m: mm } = parseMonth(m)
  return new Date(Date.UTC(y, mm, 0)).getUTCDate()
}

export function dueDateOf(m: MonthKey, dueDay: number): ISODate {
  return `${m}-${pad(Math.min(dueDay, daysInMonth(m)))}`
}

function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

/** b - a gün */
export function dayDiff(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000)
}

export function addDays(d: ISODate, n: number): ISODate {
  const t = new Date(toUTC(d) + n * 86_400_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Son n ay (bu ay dahil), eskiden yeniye */
export function lastMonths(current: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => addMonths(current, i - (n - 1)))
}

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const MONTHS_TR_LONG = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

export function monthLabel(m: MonthKey, long = false): string {
  const { y, m: mm } = parseMonth(m)
  return long ? `${MONTHS_TR_LONG[mm - 1]} ${y}` : `${MONTHS_TR[mm - 1]} ${String(y).slice(2)}`
}

export function formatDate(d: ISODate): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}
