/**
 * Kullanıcı / yetki yardımcıları.
 *
 * ÖNEMLİ: Bu kilit tarayıcı içinde çalışır. Aynı bilgisayardaki meraklı birine karşı
 * korur, ancak gerçek güvenlik değildir (teknik bilgisi olan biri tarayıcı verisini
 * okuyabilir). Gerçek çok kullanıcılı kullanımda Supabase Auth + RLS kullanın
 * (bkz. supabase/schema.sql).
 */
import type { AppUser, PageKey } from '@/types'

export const PAGES: { key: PageKey; label: string; hint: string }[] = [
  { key: 'dashboard', label: 'Genel Bakış', hint: 'Özet rakamlar, uyarılar' },
  { key: 'gunluk', label: 'Şantiye Günlüğü', hint: 'Gün gün olanlar ve giderler' },
  { key: 'insaatlar', label: 'İnşaatlar', hint: 'Projeler, bütçe, hakedişler' },
  { key: 'mahsuplasma', label: 'Mahsuplaşma', hint: 'Ortak borç/alacak' },
  { key: 'kiracilar', label: 'Kiracılar', hint: 'Kiracı ekleme, kira tahsilatı' },
  { key: 'mulkler', label: 'Mülkler & Kiralar', hint: 'Ödeme matrisi, mülk giderleri' },
  { key: 'islemler', label: 'Tüm İşlemler', hint: 'Bütün defter' },
  { key: 'ayarlar', label: 'Ortaklar & Ayarlar', hint: 'Ortaklar, yedek, veri silme' },
]

export const PAGE_PATH: Record<PageKey, string> = {
  dashboard: '/dashboard',
  gunluk: '/gunluk',
  insaatlar: '/insaatlar',
  mahsuplasma: '/mahsuplasma',
  kiracilar: '/kiracilar',
  mulkler: '/mulkler-ve-kiralar',
  islemler: '/islemler',
  ayarlar: '/ayarlar',
}

export function canSee(user: AppUser | undefined, page: PageKey | 'kullanicilar'): boolean {
  if (!user || !user.active) return false
  if (user.role === 'yonetici') return true
  if (page === 'kullanicilar') return false
  return user.pages.includes(page)
}

export const canAdd = (u?: AppUser) => !!u && (u.role === 'yonetici' || u.canAdd)
export const canEdit = (u?: AppUser) => !!u && (u.role === 'yonetici' || u.canEdit)

export function firstAllowedPath(user: AppUser | undefined): string {
  const p = PAGES.find((x) => canSee(user, x.key))
  return p ? PAGE_PATH[p.key] : '/yetki-yok'
}

export function newSalt(): string {
  const a = new Uint8Array(8)
  crypto.getRandomValues(a)
  return 's-' + [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(user: AppUser, password: string): Promise<boolean> {
  return (await hashPassword(user.salt, password)) === user.passwordHash
}

export const normalizeUsername = (s: string) =>
  s
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/\s+/g, '')
