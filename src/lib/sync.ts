/**
 * BULUT SENKRONİZASYONU
 * ---------------------
 * - Uygulama yerel Zustand store ile çalışır (hızlı, çevrimdışı da açılır).
 * - Store'daki her değişiklik farka çevrilip (syncDiff) bir kuyruğa yazılır ve Supabase'e gönderilir.
 * - Kuyruk tarayıcıda saklanır: şantiyede internet yokken girilen kayıt, bağlantı gelince gönderilir.
 * - Diğer kişilerin değişiklikleri canlı (realtime) gelir; uygulama arka plandan dönünce de tazelenir.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { useAppStore } from '@/store/useAppStore'
import { notify } from '@/store/useToastStore'
import { isNetworkError, trError } from './backend'
import {
  applyChange,
  buildSnapshot,
  coalesce,
  diffSnapshots,
  opKey,
  profileToUser,
  SYNCED,
  type Op,
  type ProfileRow,
  type SyncedCollection,
} from './syncDiff'

const QUEUE_KEY = 'santiye-gonderilecek'
const PAGE = 1000

export type SyncState = 'hazir' | 'gonderiliyor' | 'cevrimdisi' | 'hata' | 'yukleniyor'

export const useSyncStatus = create<{ state: SyncState; pending: number; lastSync: number | null }>()(() => ({
  state: 'yukleniyor',
  pending: 0,
  lastSync: null,
}))

function readQueue(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Op[]
  } catch {
    return []
  }
}
function writeQueue(q: Op[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    /* depolama yoksa yalnızca bellekte */
  }
}

let queue: Op[] = []
let applyingRemote = false
let flushing = false
let unsubStore: (() => void) | null = null
let channel: RealtimeChannel | null = null
let retryTimer: ReturnType<typeof setInterval> | null = null
let client: SupabaseClient | null = null
let listenersBound = false

/** Sunucudan gelen değişikliği store'a, geri gönderim tetiklemeden uygular */
export function applyRemote(fn: () => void) {
  applyingRemote = true
  try {
    fn()
  } finally {
    applyingRemote = false
  }
}

function setPending() {
  useSyncStatus.setState({ pending: queue.length })
}

export function enqueue(ops: Op[]) {
  if (!ops.length) return
  queue = coalesce(queue, ops)
  writeQueue(queue)
  setPending()
  void flush()
}

async function sendOp(c: SupabaseClient, op: Op) {
  switch (op.kind) {
    case 'upsert': {
      const { error } = await c.from('records').upsert({ collection: op.collection, id: op.id, data: op.data })
      if (error) throw error
      return
    }
    case 'delete': {
      const { error } = await c.from('records').delete().eq('collection', op.collection).eq('id', op.id)
      if (error) throw error
      return
    }
    case 'profile': {
      const { error } = await c.from('profiles').update(op.data).eq('id', op.id)
      if (error) throw error
      return
    }
    case 'profile-delete': {
      const { error } = await c.rpc('admin_delete_user', { target: op.id })
      if (error) throw error
      return
    }
  }
}

export async function flush(): Promise<void> {
  if (flushing || !client) return
  flushing = true
  let rejected = false
  try {
    while (queue.length) {
      useSyncStatus.setState({ state: 'gonderiliyor' })
      const op = queue[0]
      try {
        await sendOp(client, op)
      } catch (e) {
        if (isNetworkError(e)) {
          useSyncStatus.setState({ state: 'cevrimdisi' })
          return
        }
        // Yetki / doğrulama hatası: işlemi bırak, kullanıcıya söyle, sunucu haline dön
        notify(`Kaydedilemedi: ${trError(e)}`, 'error')
        rejected = true
      }
      queue = queue.filter((x) => x !== op)
      writeQueue(queue)
      setPending()
    }
    useSyncStatus.setState({ state: 'hazir', lastSync: Date.now() })
  } finally {
    flushing = false
    if (rejected) void reloadAll()
  }
}

async function fetchAllRecords(c: SupabaseClient) {
  const rows: { collection: string; id: string; data: unknown }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await c
      .from('records')
      .select('collection,id,data')
      .order('collection')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export async function reloadProfiles() {
  if (!client) return
  const { data, error } = await client.from('profiles').select('id,name,username,role,pages,can_add,can_edit,active').order('created_at')
  if (error) throw error
  applyRemote(() => useAppStore.setState({ users: (data as (ProfileRow & { id: string })[]).map(profileToUser) }))
}

/** Sunucudaki tüm veriyi çeker; gönderilmemiş yerel değişiklikler korunur */
export async function reloadAll() {
  if (!client) return
  try {
    const [rows] = await Promise.all([fetchAllRecords(client), reloadProfiles()])
    const snap = buildSnapshot(rows, queue)
    applyRemote(() => useAppStore.setState(snap))
    useSyncStatus.setState({ state: queue.length ? useSyncStatus.getState().state : 'hazir', lastSync: Date.now() })
  } catch (e) {
    useSyncStatus.setState({ state: isNetworkError(e) ? 'cevrimdisi' : 'hata' })
    if (!isNetworkError(e)) notify(`Veriler yüklenemedi: ${trError(e)}`, 'error')
  }
}

function subscribeRealtime(c: SupabaseClient) {
  channel = c
    .channel('santiye-kayitlar')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (payload) => {
      const row = (payload.new && 'collection' in payload.new ? payload.new : payload.old) as { collection?: string; id?: string; data?: unknown }
      if (!row?.collection || !row.id || !(SYNCED as readonly string[]).includes(row.collection)) return
      const col = row.collection as SyncedCollection
      // Bu kayıtta gönderilmemiş yerel değişiklik varsa yerel olan geçerli
      if (queue.some((op) => opKey(op) === `${col}/${row.id}`)) return
      const data = payload.eventType === 'DELETE' ? null : ((payload.new as { data: { id: string } }).data ?? null)
      applyRemote(() =>
        useAppStore.setState((s) => ({ [col]: applyChange(s[col] as { id: string }[], row.id!, data as { id: string } | null) }) as never),
      )
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void reloadProfiles().catch(() => undefined)
    })
    .subscribe()
}

function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  window.addEventListener('online', () => void flush())
  document.addEventListener('visibilitychange', () => {
    // Telefon uygulaması arka plandan dönünce: bekleyenleri gönder, yenileri çek
    if (document.visibilityState === 'visible' && client) {
      void flush().then(() => reloadAll())
    }
  })
}

/** Girişten sonra çağrılır */
export async function startSync(c: SupabaseClient) {
  stopSync()
  client = c
  queue = readQueue()
  setPending()
  useSyncStatus.setState({ state: 'yukleniyor' })
  // Önce dinlemeye başla: yükleme sürerken girilen kayıtlar da gönderilsin
  unsubStore = useAppStore.subscribe((state, prev) => {
    if (applyingRemote) return
    enqueue(diffSnapshots(prev, state))
  })
  await reloadAll()
  subscribeRealtime(c)
  bindListeners()
  retryTimer = setInterval(() => {
    if (queue.length) void flush()
  }, 15_000)
  void flush()
}

export function stopSync() {
  unsubStore?.()
  unsubStore = null
  if (channel && client) void client.removeChannel(channel)
  channel = null
  if (retryTimer) clearInterval(retryTimer)
  retryTimer = null
  client = null
}

export const pendingCount = () => queue.length

/** Çıkışta: bu cihazdaki önbelleği ve bekleyen kuyruğu temizler */
export function clearLocal() {
  queue = []
  writeQueue(queue)
  setPending()
  applyRemote(() =>
    useAppStore.setState({
      ...(Object.fromEntries(SYNCED.map((c) => [c, []])) as Record<SyncedCollection, []>),
      users: [],
    }),
  )
}

/** Test yardımcıları */
export const __test = {
  getQueue: () => queue,
  setClient: (c: SupabaseClient | null) => {
    client = c
  },
  reset: () => {
    stopSync()
    queue = []
    writeQueue([])
  },
}
