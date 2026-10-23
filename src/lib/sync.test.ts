import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useAppStore } from '@/store/useAppStore'
import { useToastStore } from '@/store/useToastStore'
import { EMPTY_SNAPSHOT } from '@/data/seed'
import { __test, flush, startSync, stopSync, useSyncStatus } from './sync'
import { buildSnapshot, coalesce, diffSnapshots } from './syncDiff'
import type { Transaction } from '@/types'

// ── Basit localStorage taklidi ──
const mem = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
}

// ── Sahte Supabase istemcisi ──
type Row = { collection: string; id: string; data: unknown }
function fakeClient(opts: { rows?: Row[] } = {}) {
  const db = new Map<string, Row>((opts.rows ?? []).map((r) => [`${r.collection}/${r.id}`, r]))
  const profiles = new Map<string, Record<string, unknown>>([
    ['u1', { id: 'u1', name: 'Ahmet', username: 'ahmet', role: 'yonetici', pages: [], can_add: true, can_edit: true, active: true }],
  ])
  const calls: string[] = []
  let failMode: 'none' | 'network' | 'rls' = 'none'
  let realtimeHandler: ((p: unknown) => void) | null = null
  const err = () =>
    failMode === 'network'
      ? { message: 'TypeError: Failed to fetch' }
      : failMode === 'rls'
        ? { message: 'new row violates row-level security policy for table "records"', code: '42501' }
        : null

  const client = {
    from(table: string) {
      if (table === 'records') {
        return {
          select: () => {
            const q = {
              order: () => q,
              range: async (from: number, to: number) => {
                const e = failMode === 'network' ? err() : null // yetki hatası yalnızca yazmada
                if (e) return { data: null, error: e }
                return { data: [...db.values()].slice(from, to + 1), error: null }
              },
            }
            return q
          },
          upsert: async (row: Row) => {
            calls.push(`upsert ${row.collection}/${row.id}`)
            const e = err()
            if (!e) db.set(`${row.collection}/${row.id}`, row)
            return { error: e }
          },
          delete: () => {
            const filters: Record<string, string> = {}
            const chain = {
              eq(k: string, v: string) {
                filters[k] = v
                if (Object.keys(filters).length < 2) return chain
                calls.push(`delete ${filters.collection}/${filters.id}`)
                const e = err()
                if (!e) db.delete(`${filters.collection}/${filters.id}`)
                return Promise.resolve({ error: e })
              },
            }
            return chain
          },
        }
      }
      // profiles
      return {
        select: () => ({ order: async () => ({ data: [...profiles.values()], error: null }) }),
        update: (data: Record<string, unknown>) => ({
          eq: async (_k: string, id: string) => {
            calls.push(`profile ${id} active=${data.active}`)
            profiles.set(id, { ...profiles.get(id), ...data })
            return { error: err() }
          },
        }),
      }
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push(`rpc ${fn} ${JSON.stringify(args)}`)
      return { data: null, error: err() }
    },
    channel() {
      const ch = {
        on(_e: string, filter: { table: string }, cb: (p: unknown) => void) {
          if (filter.table === 'records') realtimeHandler = cb
          return ch
        },
        subscribe: () => ch,
      }
      return ch
    },
    removeChannel: async () => undefined,
  }
  return {
    client: client as unknown as SupabaseClient,
    db,
    calls,
    profiles,
    setFail: (m: typeof failMode) => (failMode = m),
    emit: (p: unknown) => realtimeHandler?.(p),
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const sampleTx = (id: string, amount = 100): Transaction => ({
  id, kind: 'gider', scope: 'ortak', date: '2026-10-01', description: `Gider ${id}`, amount,
  payer: { kind: 'kasa' }, projectId: 'pr1', createdAt: '2026-10-01T00:00:00Z',
})

beforeEach(() => {
  __test.reset()
  mem.clear()
  useToastStore.setState({ toasts: [] })
  useAppStore.setState({ ...EMPTY_SNAPSHOT })
})

describe('syncDiff', () => {
  it('eklenen, değişen ve silinen kayıtları bulur', () => {
    const a = sampleTx('a')
    const b = sampleTx('b')
    const prev = { transactions: [a, b] }
    const next = { transactions: [a, { ...b, amount: 5 }, sampleTx('c')] }
    const ops = diffSnapshots(prev, next)
    expect(ops.map((o) => `${o.kind}:${'id' in o ? o.id : ''}`)).toEqual(['upsert:b', 'upsert:c'])
    expect(diffSnapshots(next, { transactions: [a] }).map((o) => o.kind + ':' + o.id)).toEqual(['delete:b', 'delete:c'])
  })
  it('aynı kayda ait işlemleri birleştirir', () => {
    const q = coalesce(
      [{ kind: 'upsert', collection: 'transactions', id: 'x', data: 1 }],
      [{ kind: 'upsert', collection: 'transactions', id: 'y', data: 2 }, { kind: 'delete', collection: 'transactions', id: 'x' }],
    )
    expect(q.map((o) => `${o.kind}:${'id' in o ? o.id : ''}`)).toEqual(['upsert:y', 'delete:x'])
  })
  it('sunucu verisinin üstüne gönderilmemiş yerel işlemleri uygular', () => {
    const snap = buildSnapshot(
      [{ collection: 'transactions', id: 'a', data: sampleTx('a') }, { collection: 'transactions', id: 'b', data: sampleTx('b') }],
      [{ kind: 'delete', collection: 'transactions', id: 'a' }, { kind: 'upsert', collection: 'transactions', id: 'c', data: sampleTx('c') }],
    )
    expect(snap.transactions.map((t) => t.id)).toEqual(['b', 'c'])
  })
})

describe('bulut senkronizasyonu', () => {
  it('girişte sunucudaki veriyi ve kullanıcıları yükler', async () => {
    const f = fakeClient({ rows: [{ collection: 'transactions', id: 't1', data: sampleTx('t1') }, { collection: 'projects', id: 'pr1', data: { id: 'pr1', name: 'Bağlar' } }] })
    await startSync(f.client)
    const s = useAppStore.getState()
    expect(s.transactions.map((t) => t.id)).toEqual(['t1'])
    expect(s.projects).toHaveLength(1)
    expect(s.users[0].username).toBe('ahmet')
    expect(f.calls).toEqual([]) // yükleme geri gönderim yapmaz
    stopSync()
  })

  it('yerel ekleme, değişiklik ve silmeyi sunucuya yazar', async () => {
    const f = fakeClient()
    await startSync(f.client)
    const tx = useAppStore.getState().addTransaction({ ...sampleTx('x'), id: undefined } as never)
    await tick()
    expect(f.calls).toEqual([`upsert transactions/${tx.id}`])
    useAppStore.getState().upsert('transactions', { ...tx, amount: 999 })
    await tick()
    expect((f.db.get(`transactions/${tx.id}`)!.data as Transaction).amount).toBe(999)
    useAppStore.getState().remove('transactions', tx.id)
    await tick()
    expect(f.db.has(`transactions/${tx.id}`)).toBe(false)
    expect(useSyncStatus.getState().state).toBe('hazir')
    stopSync()
  })

  it('başkasının girdiği kaydı canlı alır ve geri göndermez', async () => {
    const f = fakeClient()
    await startSync(f.client)
    f.emit({ eventType: 'INSERT', new: { collection: 'transactions', id: 'r1', data: sampleTx('r1', 777) }, old: {} })
    expect(useAppStore.getState().transactions.map((t) => t.amount)).toEqual([777])
    f.emit({ eventType: 'DELETE', new: {}, old: { collection: 'transactions', id: 'r1' } })
    expect(useAppStore.getState().transactions).toHaveLength(0)
    await tick()
    expect(f.calls).toEqual([])
    stopSync()
  })

  it('internet yokken kayıtları saklar, bağlantı gelince gönderir', async () => {
    const f = fakeClient()
    await startSync(f.client)
    f.setFail('network')
    useAppStore.getState().upsert('transactions', sampleTx('off1'))
    useAppStore.getState().upsert('transactions', sampleTx('off2'))
    await tick()
    expect(useSyncStatus.getState().state).toBe('cevrimdisi')
    expect(useSyncStatus.getState().pending).toBe(2)
    expect(JSON.parse(mem.get('santiye-gonderilecek')!)).toHaveLength(2) // telefon kapansa da kaybolmaz
    f.setFail('none')
    await flush()
    expect(f.db.has('transactions/off1') && f.db.has('transactions/off2')).toBe(true)
    expect(useSyncStatus.getState().pending).toBe(0)
    stopSync()
  })

  it('yetkisiz işlemi bildirir ve sunucudaki hale geri döner', async () => {
    const f = fakeClient({ rows: [{ collection: 'transactions', id: 'keep', data: sampleTx('keep') }] })
    await startSync(f.client)
    f.setFail('rls')
    useAppStore.getState().remove('transactions', 'keep')
    await tick()
    f.setFail('none')
    await new Promise((r) => setTimeout(r, 10))
    expect(useToastStore.getState().toasts[0]?.text).toMatch(/yetkiniz yok/i)
    expect(useAppStore.getState().transactions.map((t) => t.id)).toEqual(['keep'])
    stopSync()
  })

  it('kullanıcı yetki değişikliğini profillere yazar, silmeyi yönetici fonksiyonuyla yapar', async () => {
    const f = fakeClient()
    f.profiles.set('u2', { id: 'u2', name: 'Hasan', username: 'hasan', role: 'eleman', pages: [], can_add: false, can_edit: false, active: false })
    await startSync(f.client)
    const hasan = useAppStore.getState().users.find((u) => u.id === 'u2')!
    useAppStore.getState().upsert('users', { ...hasan, active: true, pages: ['gunluk'] })
    await tick()
    expect(f.calls).toContain('profile u2 active=true')
    useAppStore.getState().remove('users', 'u2')
    await tick()
    expect(f.calls.some((c) => c.startsWith('rpc admin_delete_user'))).toBe(true)
    stopSync()
  })
})
