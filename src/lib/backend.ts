/**
 * Çalışma modu:
 *  - BULUT: .env içinde VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY varsa.
 *    Veriler Supabase'de, herkes kendi telefonundan aynı veriyi görür.
 *  - YEREL (demo): anahtarlar yoksa. Veriler yalnızca bu tarayıcıda, demo hesaplarıyla.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeUsername } from './auth'

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
export const CLOUD = !!(SUPABASE_URL && SUPABASE_KEY)

/**
 * Kullanıcılar e-posta yerine kullanıcı adıyla girer; Supabase'e "hasan@<alan>" olarak kaydedilir.
 * E-posta onayı kapalı olduğundan bu adrese hiçbir zaman e-posta gönderilmez.
 */
export const USERNAME_DOMAIN = (import.meta.env.VITE_USERNAME_DOMAIN ?? 'santiye-defteri.app').trim()

export function usernameToEmail(input: string): string {
  const s = input.trim().toLowerCase()
  return s.includes('@') ? s : `${normalizeUsername(s)}@${USERNAME_DOMAIN}`
}

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (!CLOUD) throw new Error('Supabase yapılandırılmamış')
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'santiye-oturum' },
  })
  return client
}

/** Yönetici başka kullanıcı oluştururken kendi oturumu bozulmasın diye ayrı, oturumsuz istemci */
export function isolatedClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'santiye-gecici' },
  })
}

/** Supabase hata mesajlarını Türkçe, anlaşılır hale getirir */
export function trError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e)
  if (/Invalid login credentials/i.test(msg)) return 'Kullanıcı adı veya şifre hatalı.'
  if (/already registered|already exists|duplicate key/i.test(msg)) return 'Bu kullanıcı adı zaten kullanılıyor.'
  if (/Database error saving new user/i.test(msg)) return 'Bu kullanıcı adı zaten kullanılıyor.'
  if (/Password should be at least|at least 6/i.test(msg)) return 'Şifre en az 6 karakter olmalı.'
  if (/Email not confirmed/i.test(msg)) return "Supabase'de e-posta onayı açık. Kurulum rehberindeki 'Confirm email' adımını kapatın."
  if (/Signups not allowed/i.test(msg)) return "Supabase'de yeni kayıt kapalı. Authentication ayarlarından 'Allow new users to sign up' açık olmalı."
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) return 'İnternet bağlantısı yok veya sunucuya ulaşılamıyor.'
  if (/row-level security|permission denied|Yetkiniz yok/i.test(msg)) return 'Bu işlem için yetkiniz yok.'
  if (/Son yönetici/i.test(msg)) return 'Son yönetici kapatılamaz veya elemana çevrilemez.'
  if (/rate limit/i.test(msg)) return 'Çok fazla deneme yapıldı, biraz bekleyip tekrar deneyin.'
  return msg
}

export function isNetworkError(e: unknown): boolean {
  const msg = (e as { message?: string })?.message ?? String(e)
  return /Failed to fetch|NetworkError|Load failed|network|timeout|ECONN|fetch failed/i.test(msg)
}
