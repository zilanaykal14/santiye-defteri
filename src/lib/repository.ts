/**
 * KALICI DEPOLAMA KATMANI (Repository / Adapter)
 * ----------------------------------------------
 * Uygulama verisi `DataSnapshot` biçimindedir. Store bu arayüz üzerinden okur/yazar;
 * LocalStorage yerine Supabase/Firebase kullanmak için yalnızca yeni bir adapter yazmak yeterli.
 * Supabase tablo şeması: /supabase/schema.sql
 */
import type { StateStorage } from 'zustand/middleware'

/** Zustand persist için hatalara dayanıklı localStorage (gizli sekme, kota dolu vb.) */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      /* depolama kullanılamıyor — oturum belleğinde devam */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* yoksay */
    }
  },
}

/**
 * Supabase adapter iskeleti (örnek). Etkinleştirmek için:
 *   npm i @supabase/supabase-js
 * ve store.ts içinde `storage` olarak bunu verin, ya da daha iyisi her CRUD
 * aksiyonunda ilgili tabloya `upsert/delete` yapın (bkz. README "Supabase'e geçiş").
 *
 * export const supabaseStorage = (client: SupabaseClient, userId: string): StateStorage => ({
 *   getItem: async () => {
 *     const { data } = await client.from('app_state').select('state').eq('user_id', userId).single()
 *     return data ? JSON.stringify(data.state) : null
 *   },
 *   setItem: async (_n, value) => {
 *     await client.from('app_state').upsert({ user_id: userId, state: JSON.parse(value) })
 *   },
 *   removeItem: async () => {
 *     await client.from('app_state').delete().eq('user_id', userId)
 *   },
 * })
 */
