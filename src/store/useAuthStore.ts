import { create } from 'zustand'
import { useAppStore, setStoreUser } from './useAppStore'
import { canAdd, canEdit, canSee, normalizeUsername, verifyPassword } from '@/lib/auth'
import { CLOUD } from '@/lib/backend'
import type { ID, PageKey } from '@/types'

const KEY = 'santiye-oturum-yerel'
const MAX_TRIES = 5
const LOCK_MS = 30_000

function readSession(): ID | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}
function writeSession(id: ID | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* depolama kapalı: oturum yalnızca bellekte */
  }
}

interface AuthState {
  userId: ID | null
  /** Bulut modunda kayıtlı oturum kontrolü bitti mi */
  ready: boolean
  failed: number
  lockedUntil: number
  init: () => Promise<void>
  login: (username: string, password: string) => Promise<string | null>
  /** Bulut: ilk yönetici hesabını oluşturur */
  setup: (name: string, username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

/**
 * Oturum yönetimi.
 *  - Yerel (demo) modda: şifre özeti tarayıcıda doğrulanır, oturum sekme kapanınca biter.
 *  - Bulut modunda: Supabase Auth; oturum telefonda açık kalır (uygulama gibi).
 */
export const useAuthStore = create<AuthState>()((set, get) => {
  const localInitial = CLOUD ? null : readSession()
  setStoreUser(localInitial ?? undefined)

  /** Girişten sonra kullanıcı kendi ilk sayfasından başlasın (önceki kişinin sayfasından değil) */
  const goHome = () => {
    try {
      if (import.meta.env.VITE_HASH_ROUTER) window.location.hash = '#/'
      else window.history.replaceState(null, '', '/')
    } catch {
      /* yoksay */
    }
  }
  const finishLogin = (uid: ID) => {
    setStoreUser(uid)
    set({ userId: uid, failed: 0, lockedUntil: 0 })
  }
  const tooMany = () => {
    const now = Date.now()
    return get().lockedUntil > now ? `Çok fazla hatalı deneme. ${Math.ceil((get().lockedUntil - now) / 1000)} sn bekleyin.` : null
  }
  const registerFail = () => {
    const failed = get().failed + 1
    set(failed >= MAX_TRIES ? { failed: 0, lockedUntil: Date.now() + LOCK_MS } : { failed })
  }

  return {
    userId: localInitial,
    ready: !CLOUD,
    failed: 0,
    lockedUntil: 0,

    init: async () => {
      if (!CLOUD || get().ready) return
      const { restoreSession } = await import('@/lib/cloudAuth')
      const uid = await restoreSession().catch(() => null)
      if (uid) finishLogin(uid)
      set({ ready: true })
    },

    login: async (username, password) => {
      const locked = tooMany()
      if (locked) return locked
      if (CLOUD) {
        const { cloudLogin } = await import('@/lib/cloudAuth')
        const res = await cloudLogin(username, password)
        if (res.error || !res.uid) {
          registerFail()
          return res.error ?? 'Giriş yapılamadı.'
        }
        goHome()
        finishLogin(res.uid)
        return null
      }
      const user = useAppStore.getState().users.find((u) => u.username === normalizeUsername(username))
      const ok = !!user && user.active && (await verifyPassword(user, password))
      if (!ok || !user) {
        registerFail()
        if (user && !user.active) return 'Bu hesap yönetici tarafından kapatılmış.'
        return 'Kullanıcı adı veya şifre hatalı.'
      }
      writeSession(user.id)
      goHome()
      finishLogin(user.id)
      return null
    },

    setup: async (name, username, password) => {
      const { cloudSetup } = await import('@/lib/cloudAuth')
      const res = await cloudSetup(name, username, password)
      if (res.error || !res.uid) return res.error ?? 'Kurulum tamamlanamadı.'
      goHome()
      finishLogin(res.uid)
      return null
    },

    logout: async () => {
      if (CLOUD) {
        const { cloudLogout } = await import('@/lib/cloudAuth')
        await cloudLogout()
      }
      writeSession(null)
      setStoreUser(undefined)
      set({ userId: null })
    },
  }
})

export function useCurrentUser() {
  const id = useAuthStore((s) => s.userId)
  return useAppStore((s) => s.users.find((u) => u.id === id))
}

/** Yetki kısayolları */
export function useCan() {
  const user = useCurrentUser()
  return {
    user,
    isAdmin: user?.role === 'yonetici',
    add: canAdd(user),
    edit: canEdit(user),
    see: (p: PageKey | 'kullanicilar') => canSee(user, p),
  }
}

/** Render dışı kullanım (tablo kolon üreticileri vb.) */
export function currentCanEdit(): boolean {
  const id = useAuthStore.getState().userId
  return canEdit(useAppStore.getState().users.find((u) => u.id === id))
}
