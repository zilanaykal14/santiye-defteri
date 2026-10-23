/** Supabase Auth işlemleri (yalnızca bulut modunda kullanılır) */
import { isolatedClient, supabase, trError, usernameToEmail } from './backend'
import { normalizeUsername } from './auth'
import { applyRemote, clearLocal, reloadProfiles, startSync, stopSync } from './sync'
import { profileToUser, type ProfileRow } from './syncDiff'
import { useAppStore } from '@/store/useAppStore'
import type { AppUser, UserRole } from '@/types'

async function loadOwnProfile(uid: string): Promise<AppUser | null> {
  const { data, error } = await supabase()
    .from('profiles')
    .select('id,name,username,role,pages,can_add,can_edit,active')
    .eq('id', uid)
    .maybeSingle()
  if (error) throw error
  return data ? profileToUser(data as ProfileRow & { id: string }) : null
}

/** Uygulama açılışında: kayıtlı oturum varsa kullanıcıyı döndürür */
export async function restoreSession(): Promise<string | null> {
  const { data } = await supabase().auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return null
  try {
    const me = await loadOwnProfile(uid)
    if (!me?.active) {
      await supabase().auth.signOut()
      return null
    }
    applyRemote(() => useAppStore.setState((s) => ({ users: s.users.some((u) => u.id === me.id) ? s.users : [...s.users, me] })))
  } catch {
    // Çevrimdışı açılış: önbellekteki kullanıcıyla devam
    if (!useAppStore.getState().users.some((u) => u.id === uid)) return null
  }
  void startSync(supabase())
  return uid
}

export async function cloudLogin(username: string, password: string): Promise<{ uid?: string; error?: string }> {
  const { data, error } = await supabase().auth.signInWithPassword({ email: usernameToEmail(username), password })
  if (error || !data.user) return { error: trError(error) }
  const me = await loadOwnProfile(data.user.id).catch(() => null)
  if (!me) {
    await supabase().auth.signOut()
    return { error: 'Hesap profili bulunamadı. Yöneticinize başvurun.' }
  }
  if (!me.active) {
    await supabase().auth.signOut()
    return { error: 'Hesabınız henüz yönetici tarafından açılmadı.' }
  }
  applyRemote(() => useAppStore.setState({ users: [me] }))
  await startSync(supabase())
  return { uid: me.id }
}

export async function needsSetup(): Promise<boolean | null> {
  const { data, error } = await supabase().rpc('needs_setup')
  if (error) return null
  return !!data
}

/** İlk kurulum: ilk hesap otomatik yönetici olur */
export async function cloudSetup(name: string, username: string, password: string) {
  const { data, error } = await supabase().auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { name, username: normalizeUsername(username) } },
  })
  if (error) return { error: trError(error) }
  if (!data.session) {
    return { error: "Hesap oluştu ama giriş yapılamadı: Supabase'de 'Confirm email' kapalı olmalı (rehber 3. adım)." }
  }
  return cloudLogin(username, password)
}

export async function cloudLogout() {
  stopSync()
  await supabase().auth.signOut().catch(() => undefined)
  clearLocal()
}

/** Yönetici yeni kullanıcı ekler */
export async function cloudCreateUser(input: { name: string; username: string; password: string; role: UserRole }) {
  const username = normalizeUsername(input.username)
  const { data, error } = await isolatedClient().auth.signUp({
    email: usernameToEmail(username),
    password: input.password,
    options: { data: { name: input.name, username } },
  })
  if (error || !data.user) return { error: trError(error ?? new Error('Kullanıcı oluşturulamadı')) }
  // Supabase var olan e-posta için hata yerine "boş kimlikli" kullanıcı döndürebilir
  if (data.user.identities && data.user.identities.length === 0) return { error: 'Bu kullanıcı adı zaten kullanılıyor.' }
  const { error: upErr } = await supabase()
    .from('profiles')
    .update({
      name: input.name,
      role: input.role,
      pages: input.role === 'eleman' ? ['gunluk'] : [],
      can_add: true,
      can_edit: input.role === 'yonetici',
      active: true,
    })
    .eq('id', data.user.id)
  if (upErr) return { error: trError(upErr) }
  await reloadProfiles()
  return { uid: data.user.id }
}

export async function cloudSetPassword(uid: string, password: string) {
  const { error } = await supabase().rpc('admin_set_password', { target: uid, new_password: password })
  return error ? trError(error) : null
}

export async function cloudChangeOwnPassword(username: string, oldPw: string, newPw: string) {
  const check = await supabase().auth.signInWithPassword({ email: usernameToEmail(username), password: oldPw })
  if (check.error) return 'Mevcut şifre yanlış.'
  const { error } = await supabase().auth.updateUser({ password: newPw })
  return error ? trError(error) : null
}
