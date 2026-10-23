import * as React from 'react'
import { Building2, ChevronLeft, ChevronRight, FileText, Home, Plus, UserPlus } from 'lucide-react'
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Table, TBody, TD, TFoot, TH, THead, TR, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui'
import { EmptyState, Money, PageHeader, RentStatusBadge } from '@/components/shared'
import { DataTable } from '@/components/shared/DataTable'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { useUIStore } from '@/store/useUIStore'
import { useToday } from '@/hooks/useFinance'
import { rentCell } from '@/lib/rent'
import { formatDate, monthLabel } from '@/lib/dates'
import { CATEGORY_LABEL, PROPERTY_CATEGORIES } from '@/lib/labels'
import { transactionColumns } from '@/features/islemler/columns'
import { cn } from '@/lib/utils'
import { formatThousands } from '@/lib/money'
import { PropertyDialog, RentPaymentDialog } from './dialogs'
import { Link } from 'react-router-dom'
import { useCan } from '@/store/useAuthStore'
import type { Kurus, MonthKey, RentStatus } from '@/types'

const CELL_CLS: Record<RentStatus, string> = {
  odendi: 'bg-positive-bg text-positive border-positive/30',
  kismi: 'bg-warning-bg text-warning border-warning/40',
  gecikmede: 'bg-negative-bg text-negative border-negative/40',
  yaklasan: 'bg-info-bg text-info border-info/30',
  bekliyor: 'bg-card text-muted-foreground border-dashed',
}

export function PropertiesPage() {
  const { properties, units, tenants, leases, rentPayments, transactions, partners, projects, remove } = useAppStore()
  const openTx = useUIStore((s) => s.openTxDialog)
  const { today, month } = useToday()
  const [year, setYear] = React.useState(Number(month.slice(0, 4)))
  const [payTarget, setPayTarget] = React.useState<{ leaseId: string; month: MonthKey; expected: Kurus; paid: Kurus } | null>(null)
  const can = useCan()
  const [propOpen, setPropOpen] = React.useState(false)

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const activeLeases = leases.filter((l) => l.active)
  const unitOf = (id: string) => units.find((u) => u.id === id)
  const propOf = (id?: string) => properties.find((p) => p.id === id)
  const tenantOf = (id: string) => tenants.find((t) => t.id === id)

  const colTotals = months.map((m) => {
    let exp = 0
    let paid = 0
    for (const l of activeLeases) {
      const c = rentCell(l, m, rentPayments, today)
      if (c) {
        exp += c.expected
        paid += c.paid
      }
    }
    return { exp, paid }
  })

  const propTxs = transactions.filter((t) => t.propertyId)
  const columns = transactionColumns({
    partners: new Map(partners.map((p) => [p.id, p])),
    projects: new Map(projects.map((p) => [p.id, p])),
    properties: new Map(properties.map((p) => [p.id, p])),
    onEdit: (tx) => {
      const { id, createdAt: _c, ...rest } = tx
      void _c
      openTx(rest, id)
    },
    onDelete: (tx) => askConfirm(`"${tx.description}" silinsin mi?`, () => { remove('transactions', tx.id) }),
  })
  const byCat = PROPERTY_CATEGORIES.map((c) => ({
    c,
    v: propTxs.filter((t) => t.category === c && t.date.startsWith(String(year))).reduce((a, t) => a + t.amount, 0),
  })).filter((x) => x.v > 0)

  return (
    <>
      <PageHeader
        title="Mülkler & Kiralar"
        description="Bağımsız bölümler, kiracılar ve aylık tahsilat takvimi"
        actions={
          <>
            {can.add && (
              <Button variant="outline" onClick={() => setPropOpen(true)}>
                <Building2 /> Mülk ekle
              </Button>
            )}
            {can.see('kiracilar') && (
              <Button asChild>
                <Link to="/kiracilar">
                  <UserPlus /> Kiracılar
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="matris">
        <TabsList>
          <TabsTrigger value="matris">Ödeme matrisi</TabsTrigger>
          <TabsTrigger value="mulkler">Mülkler ({properties.length})</TabsTrigger>
          <TabsTrigger value="giderler">Mülk giderleri</TabsTrigger>
        </TabsList>

        {/* ── Ödeme matrisi ── */}
        <TabsContent value="matris">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Kira tahsilat takvimi</CardTitle>
                <CardDescription>Hücreye tıklayarak tahsilat girin</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setYear(year - 1)} aria-label="Önceki yıl"><ChevronLeft /></Button>
                <span className="num w-14 text-center font-medium">{year}</span>
                <Button variant="outline" size="icon" onClick={() => setYear(year + 1)} aria-label="Sonraki yıl"><ChevronRight /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                {(['odendi', 'kismi', 'gecikmede', 'yaklasan', 'bekliyor'] as RentStatus[]).map((s) => (
                  <RentStatusBadge key={s} status={s} />
                ))}
              </div>
              {activeLeases.length === 0 ? (
                <EmptyState icon={Home} title="Aktif kira sözleşmesi yok" />
              ) : (
                <Table className="min-w-[1100px]">
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH className="sticky left-0 z-10 bg-card">Bölüm / Kiracı</TH>
                      {months.map((m) => (
                        <TH key={m} className={cn('text-center', m === month && 'text-foreground')}>{monthLabel(m)}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {activeLeases.map((l) => {
                      const u = unitOf(l.unitId)
                      return (
                        <TR key={l.id} className="hover:bg-transparent">
                          <TD className="sticky left-0 z-10 bg-card">
                            <div className="font-medium">{u?.label} · <span className="text-muted-foreground">{propOf(u?.propertyId)?.name}</span></div>
                            <div className="text-xs text-muted-foreground">{tenantOf(l.tenantId)?.name}</div>
                          </TD>
                          {months.map((m) => {
                            const c = rentCell(l, m, rentPayments, today)
                            if (!c) return <TD key={m} className="text-center text-xs text-muted-foreground/50">—</TD>
                            return (
                              <TD key={m} className="p-1">
                                <button
                                  onClick={() => setPayTarget({ leaseId: l.id, month: m, expected: c.expected, paid: c.paid })}
                                  className={cn('w-full rounded-md border px-1.5 py-1.5 text-center text-[11px] leading-tight transition-transform hover:scale-[1.03] cursor-pointer', CELL_CLS[c.status], m === month && 'ring-1 ring-foreground/30')}
                                  title={`${c.status} · vade ${formatDate(c.dueDate)}`}
                                >
                                  <div className="num font-medium">{formatThousands(c.paid || c.expected)}</div>
                                  <div className="opacity-80">{c.status === 'gecikmede' ? `${c.daysLate}g` : c.status === 'kismi' ? `%${Math.round((c.paid / c.expected) * 100)}` : c.status === 'odendi' ? '✓' : formatDate(c.dueDate).slice(0, 5)}</div>
                                </button>
                              </TD>
                            )
                          })}
                        </TR>
                      )
                    })}
                  </TBody>
                  <TFoot>
                    <TR>
                      <TD className="sticky left-0 z-10 bg-muted text-xs">Tahsil / Beklenen</TD>
                      {colTotals.map((t, i) => (
                        <TD key={i} className="text-center text-[11px]">
                          <div className="num">{formatThousands(t.paid)}</div>
                          <div className="num text-muted-foreground">{formatThousands(t.exp)}</div>
                        </TD>
                      ))}
                    </TR>
                  </TFoot>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Mülkler ── */}
        <TabsContent value="mulkler">
          <div className="grid gap-4 lg:grid-cols-2">
            {properties.map((p) => {
              const us = units.filter((u) => u.propertyId === p.id)
              return (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-primary" /> {p.name}</CardTitle>
                    <CardDescription>{p.address}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline"><FileText className="size-3" /> Tapu</Badge>
                      {p.deed.ada && <span>Ada <b className="num">{p.deed.ada}</b></span>}
                      {p.deed.parsel && <span>Parsel <b className="num">{p.deed.parsel}</b></span>}
                      {p.deed.pafta && <span>Pafta <b className="num">{p.deed.pafta}</b></span>}
                      {p.deed.nitelik && <span className="text-muted-foreground">· {p.deed.nitelik}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {us.map((u) => {
                        const l = activeLeases.find((x) => x.unitId === u.id)
                        return (
                          <div key={u.id} className={cn('rounded-md border p-2.5 text-xs', l ? 'bg-accent/40' : 'border-dashed')}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{u.label}</span>
                              <Badge variant={l ? 'positive' : 'default'}>{l ? 'Kirada' : 'Boş'}</Badge>
                            </div>
                            <div className="mt-1 text-muted-foreground">{[u.rooms, u.grossM2 && `${u.grossM2} m²`, u.floor && `Kat ${u.floor}`].filter(Boolean).join(' · ') || '—'}</div>
                            {l && <div className="mt-1 truncate">{tenantOf(l.tenantId)?.name}</div>}
                          </div>
                        )
                      })}
                    </div>
                    {can.add && (
                      <Button variant="outline" size="sm" className="justify-self-start" onClick={() => openTx({ kind: 'gider', propertyId: p.id, scope: 'sahsi', category: 'dask' })}>
                        <Plus /> Mülk gideri ekle
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            {properties.length === 0 && <EmptyState icon={Building2} title="Mülk yok" />}
          </div>
        </TabsContent>

        {/* ── Mülk giderleri ── */}
        <TabsContent value="giderler">
          <div className="mb-4 flex flex-wrap gap-2">
            {byCat.map(({ c, v }) => (
              <div key={c} className="rounded-md border bg-card px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[c]} · {year}</div>
                <Money value={v} className="font-medium" />
              </div>
            ))}
          </div>
          <DataTable
            data={propTxs}
            columns={columns}
            initialSorting={[{ id: 'date', desc: true }]}
            toolbar={
              can.add && <Button size="sm" onClick={() => openTx({ kind: 'gider', propertyId: properties[0]?.id, scope: 'sahsi', category: 'dask' })}>
                <Plus /> Gider ekle
              </Button>
            }
          />
        </TabsContent>
      </Tabs>

      <RentPaymentDialog key={payTarget ? payTarget.leaseId + payTarget.month + payTarget.paid : 'none'} target={payTarget} onClose={() => setPayTarget(null)} />
      <PropertyDialog key={'p' + propOpen} open={propOpen} onOpenChange={setPropOpen} />
    </>
  )
}
