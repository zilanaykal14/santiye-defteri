/**
 * Yerel durum ile bir önceki durum arasındaki farkı, sunucuya gönderilecek işlemlere çevirir.
 * Store aksiyonları değişen kaydı YENİ nesne olarak ürettiği için referans karşılaştırması yeterlidir.
 * Saf fonksiyonlar — syncDiff.test.ts ile test edilir.
 */
import type { DataSnapshot } from '@/data/seed'
import type { AppUser } from '@/types'

export const SYNCED = [
  'partners',
  'projects',
  'properties',
  'units',
  'tenants',
  'leases',
  'rentPayments',
  'transactions',
  'siteLogs',
] as const
export type SyncedCollection = (typeof SYNCED)[number]

export type Op =
  | { kind: 'upsert'; collection: SyncedCollection; id: string; data: unknown }
  | { kind: 'delete'; collection: SyncedCollection; id: string }
  | { kind: 'profile'; id: string; data: ProfileRow }
  | { kind: 'profile-delete'; id: string }

export interface ProfileRow {
  name: string
  username: string
  role: 'yonetici' | 'eleman'
  pages: string[]
  can_add: boolean
  can_edit: boolean
  active: boolean
}

export const opKey = (op: Op) =>
  op.kind === 'profile' || op.kind === 'profile-delete' ? `profiles/${op.id}` : `${op.collection}/${op.id}`

type WithId = { id: string }

export function diffSnapshots(prev: Partial<DataSnapshot>, next: Partial<DataSnapshot>): Op[] {
  const ops: Op[] = []
  for (const c of SYNCED) {
    const a = (prev[c] ?? []) as WithId[]
    const b = (next[c] ?? []) as WithId[]
    if (a === b) continue
    const before = new Map(a.map((x) => [x.id, x]))
    const after = new Set<string>()
    for (const item of b) {
      after.add(item.id)
      if (before.get(item.id) !== item) ops.push({ kind: 'upsert', collection: c, id: item.id, data: item })
    }
    for (const id of before.keys()) if (!after.has(id)) ops.push({ kind: 'delete', collection: c, id })
  }
  const ua = prev.users ?? []
  const ub = next.users ?? []
  if (ua !== ub) {
    const before = new Map(ua.map((u) => [u.id, u]))
    const after = new Set<string>()
    for (const u of ub) {
      after.add(u.id)
      const old = before.get(u.id)
      // Yeni kullanıcı oluşturma ayrı akıştan (signUp) geçer; burada yalnızca değişiklikler
      if (old && old !== u) ops.push({ kind: 'profile', id: u.id, data: userToProfile(u) })
    }
    for (const id of before.keys()) if (!after.has(id)) ops.push({ kind: 'profile-delete', id })
  }
  return ops
}

/** Aynı kayda ait ardışık işlemlerde yalnızca sonuncusu gönderilir */
export function coalesce(queue: Op[], incoming: Op[]): Op[] {
  const map = new Map<string, Op>()
  for (const op of [...queue, ...incoming]) {
    const k = opKey(op)
    map.delete(k) // sıralamayı korumak için sona taşı
    map.set(k, op)
  }
  return [...map.values()]
}

export function userToProfile(u: AppUser): ProfileRow {
  return {
    name: u.name,
    username: u.username,
    role: u.role,
    pages: u.pages,
    can_add: u.canAdd,
    can_edit: u.canEdit,
    active: u.active,
  }
}

export function profileToUser(p: ProfileRow & { id: string }): AppUser {
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    role: p.role,
    pages: (p.pages ?? []) as AppUser['pages'],
    canAdd: p.can_add,
    canEdit: p.can_edit,
    active: p.active,
    passwordHash: '',
    salt: '',
  }
}

/** Sunucudan gelen kayıt satırlarını koleksiyonlara ayırır; bekleyen yerel işlemleri üstüne uygular */
export function buildSnapshot(
  rows: { collection: string; id: string; data: unknown }[],
  pending: Op[],
): Pick<DataSnapshot, SyncedCollection> {
  const out = Object.fromEntries(SYNCED.map((c) => [c, new Map<string, unknown>()])) as Record<SyncedCollection, Map<string, unknown>>
  for (const r of rows) {
    if ((SYNCED as readonly string[]).includes(r.collection)) out[r.collection as SyncedCollection].set(r.id, r.data)
  }
  for (const op of pending) {
    if (op.kind === 'upsert') out[op.collection].set(op.id, op.data)
    else if (op.kind === 'delete') out[op.collection].delete(op.id)
  }
  return Object.fromEntries(SYNCED.map((c) => [c, [...out[c].values()]])) as Pick<DataSnapshot, SyncedCollection>
}

/** Canlı gelen tek değişikliği koleksiyona uygular (yeni dizi döner) */
export function applyChange<T extends WithId>(list: T[], id: string, data: T | null): T[] {
  const idx = list.findIndex((x) => x.id === id)
  if (data === null) return idx === -1 ? list : list.filter((x) => x.id !== id)
  if (idx === -1) return [...list, data]
  const next = list.slice()
  next[idx] = data
  return next
}
