import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildSeed, EMPTY_SNAPSHOT, SEED_USERS, type DataSnapshot } from '@/data/seed'
import { safeLocalStorage } from '@/lib/repository'
import { uid } from '@/lib/utils'
import { CLOUD } from '@/lib/backend'
import type { ID, Lease, Partner, Project, Property, RentPayment, SiteLog, Tenant, Transaction, Unit } from '@/types'

/** Oturumdaki kullanıcı (döngüsel import olmaması için burada set edilir) */
let currentUserId: ID | undefined
export const setStoreUser = (id: ID | undefined) => {
  currentUserId = id
}

type Collection = keyof DataSnapshot
type Item<K extends Collection> = DataSnapshot[K][number]

interface AppState extends DataSnapshot {
  /** Genel CRUD — tüm koleksiyonlar için tip güvenli */
  upsert: <K extends Collection>(key: K, item: Item<K>) => void
  remove: (key: Collection, id: ID) => void

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Transaction
  addRentPayment: (p: Omit<RentPayment, 'id'>) => void
  addSiteLog: (l: Omit<SiteLog, 'id' | 'createdAt' | 'createdBy'>) => SiteLog
  addProject: (p: Omit<Project, 'id'>) => Project
  addPartner: (p: Omit<Partner, 'id'>) => Partner
  addProperty: (p: Omit<Property, 'id'>) => Property
  addUnit: (u: Omit<Unit, 'id'>) => Unit
  /** Kiracı + sözleşmeyi tek adımda ekler */
  addTenantWithLease: (t: Omit<Tenant, 'id'>, l: Omit<Lease, 'id' | 'tenantId'>) => void

  resetDemo: () => void
  clearAll: () => void
  importSnapshot: (s: DataSnapshot) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Bulut modunda boş başlar; veriler girişten sonra sunucudan gelir
      ...(CLOUD ? EMPTY_SNAPSHOT : buildSeed()),

      upsert: (key, item) =>
        set((s) => {
          const list = s[key] as Array<{ id: ID }>
          const idx = list.findIndex((x) => x.id === item.id)
          const next = idx === -1 ? [...list, item] : list.map((x) => (x.id === item.id ? item : x))
          return { [key]: next } as Partial<AppState>
        }),
      remove: (key, id) =>
        set((s) => ({ [key]: (s[key] as Array<{ id: ID }>).filter((x) => x.id !== id) }) as Partial<AppState>),

      addTransaction: (t) => {
        const tx: Transaction = { ...t, id: uid('t-'), createdAt: new Date().toISOString(), createdBy: currentUserId }
        set((s) => ({ transactions: [...s.transactions, tx] }))
        return tx
      },
      addRentPayment: (p) => set((s) => ({ rentPayments: [...s.rentPayments, { ...p, id: uid('rp-') }] })),
      addSiteLog: (l) => {
        const log: SiteLog = { ...l, id: uid('log-'), createdAt: new Date().toISOString(), createdBy: currentUserId }
        set((s) => ({ siteLogs: [...s.siteLogs, log] }))
        return log
      },
      addProject: (p) => {
        const project = { ...p, id: uid('pr-') }
        set((s) => ({ projects: [...s.projects, project] }))
        return project
      },
      addPartner: (p) => {
        const partner = { ...p, id: uid('p-') }
        set((s) => ({ partners: [...s.partners, partner] }))
        return partner
      },
      addProperty: (p) => {
        const prop = { ...p, id: uid('prop-') }
        set((s) => ({ properties: [...s.properties, prop] }))
        return prop
      },
      addUnit: (u) => {
        const unit = { ...u, id: uid('u-') }
        set((s) => ({ units: [...s.units, unit] }))
        return unit
      },
      addTenantWithLease: (t, l) => {
        const tenant = { ...t, id: uid('tn-') }
        const lease = { ...l, id: uid('l-'), tenantId: tenant.id }
        set((s) => ({ tenants: [...s.tenants, tenant], leases: [...s.leases, lease] }))
      },

      // Kullanıcılar korunur: kimse kendini sistem dışında bırakmasın
      resetDemo: () => set((s) => ({ ...buildSeed(), users: s.users })),
      clearAll: () => set((s) => ({ ...EMPTY_SNAPSHOT, users: s.users })),
      importSnapshot: (snap) => set((s) => ({ ...EMPTY_SNAPSHOT, ...snap, users: !CLOUD && snap.users?.length ? snap.users : s.users })),
    }),
    {
      name: CLOUD ? 'santiye-bulut-onbellek' : 'insaat-portfoy-v1',
      version: 2,
      migrate: (old, version) => {
        const st = (old ?? {}) as Partial<DataSnapshot>
        if (version < 2 && !CLOUD) {
          st.users = st.users?.length ? st.users : SEED_USERS
          st.siteLogs = st.siteLogs ?? []
        }
        return st as DataSnapshot
      },
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s): DataSnapshot => ({
        partners: s.partners,
        projects: s.projects,
        properties: s.properties,
        units: s.units,
        tenants: s.tenants,
        leases: s.leases,
        rentPayments: s.rentPayments,
        transactions: s.transactions,
        users: s.users,
        siteLogs: s.siteLogs,
      }),
    },
  ),
)

/** Sık kullanılan seçiciler */
export const usePrimaryPartner = () => useAppStore((s) => s.partners.find((p) => p.isPrimary))
export const usePartnerMap = () => {
  const partners = useAppStore((s) => s.partners)
  return new Map(partners.map((p) => [p.id, p]))
}
