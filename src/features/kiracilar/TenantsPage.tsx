import * as React from 'react'
import { Banknote, CalendarClock, Home, Pencil, Phone, UserPlus } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent } from '@/components/ui'
import { EmptyState, Money, PageHeader, RentStatusBadge } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { useCan } from '@/store/useAuthStore'
import { useToday } from '@/hooks/useFinance'
import { expectedRent, overdueRents, rentCell } from '@/lib/rent'
import { dayDiff, formatDate, monthLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { RentPaymentDialog } from '@/features/mulkler/dialogs'
import { TenantForm } from './TenantForm'
import type { Kurus, Lease, MonthKey } from '@/types'

type Filter = 'hepsi' | 'geciken' | 'odeyen'

export function TenantsPage() {
  const { leases, tenants, units, properties, rentPayments, upsert } = useAppStore()
  const can = useCan()
  const { today, month } = useToday()
  const [filter, setFilter] = React.useState<Filter>('hepsi')
  const [editLease, setEditLease] = React.useState<Lease | null>(null)
  const [payTarget, setPayTarget] = React.useState<{ leaseId: string; month: MonthKey; expected: Kurus; paid: Kurus } | null>(null)

  const active = leases.filter((l) => l.active)
  const overdue = overdueRents(active, rentPayments, today)
  const overdueByLease = new Map<string, typeof overdue>()
  for (const c of overdue) overdueByLease.set(c.leaseId, [...(overdueByLease.get(c.leaseId) ?? []), c])
  const expectedThis = active.reduce((a, l) => a + (rentCell(l, month, rentPayments, today)?.expected ?? 0), 0)
  const paidThis = active.reduce((a, l) => a + (rentCell(l, month, rentPayments, today)?.paid ?? 0), 0)

  const list = active
    .filter((l) => (filter === 'geciken' ? overdueByLease.has(l.id) : filter === 'odeyen' ? !overdueByLease.has(l.id) : true))
    .sort((a, b) => (overdueByLease.get(b.id)?.length ?? 0) - (overdueByLease.get(a.id)?.length ?? 0))

  const unitOf = (id: string) => units.find((u) => u.id === id)
  const propOf = (id?: string) => properties.find((p) => p.id === id)
  const tenantOf = (id: string) => tenants.find((t) => t.id === id)

  /** "Kira aldım": en eski ödenmemiş ay, yoksa bu ay */
  function openPayment(l: Lease) {
    const oldest = overdueByLease.get(l.id)?.slice().sort((a, b) => a.month.localeCompare(b.month))[0]
    const cell = oldest ?? rentCell(l, month, rentPayments, today)
    if (cell) setPayTarget({ leaseId: l.id, month: cell.month, expected: cell.expected, paid: cell.paid })
  }

  return (
    <>
      <PageHeader title="Kiracılar" description="Kiracı ekleyin, kirayı aldığınızda tek tuşla işaretleyin." />

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        {can.add && (
          <Card className="h-fit xl:sticky xl:top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-4 text-brand" /> Yeni kiracı ekle
              </CardTitle>
              <CardDescription>Sadece temel bilgiler yeterli; gerisi sonra da girilebilir.</CardDescription>
            </CardHeader>
            <CardContent>
              <TenantForm />
            </CardContent>
          </Card>
        )}

        <div className={cn('min-w-0', !can.add && 'xl:col-span-2')}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Aktif kiracı</p>
              <p className="mt-1 text-xl font-bold">{active.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{monthLabel(month, true)} tahsilat</p>
              <p className="mt-1 text-sm">
                <Money value={paidThis} className="text-lg font-bold" /> <span className="text-muted-foreground">/ <Money value={expectedThis} /></span>
              </p>
            </Card>
            <Card className={cn('p-4', overdueByLease.size > 0 && 'border-negative/40 bg-negative-bg/40')}>
              <p className="text-xs text-muted-foreground">Geciken kiracı</p>
              <p className={cn('mt-1 text-xl font-bold', overdueByLease.size > 0 && 'text-negative')}>{overdueByLease.size}</p>
            </Card>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {([['hepsi', 'Hepsi'], ['geciken', 'Gecikenler'], ['odeyen', 'Düzenli ödeyenler']] as [Filter, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium cursor-pointer', filter === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}
              >
                {label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyState icon={Home} title={active.length ? 'Bu filtrede kiracı yok' : 'Henüz kiracı yok'}>
              {can.add && !active.length && 'Soldaki formdan ilk kiracınızı ekleyin.'}
            </EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((l) => {
                const t = tenantOf(l.tenantId)
                const u = unitOf(l.unitId)
                const cur = rentCell(l, month, rentPayments, today)
                const late = overdueByLease.get(l.id) ?? []
                const lateTotal = late.reduce((a, c) => a + c.expected - c.paid, 0)
                const daysLeft = dayDiff(today, l.endDate)
                return (
                  <Card key={l.id} className={cn('p-4', late.length > 0 && 'border-negative/40')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold">{t?.name}</h3>
                        <p className="truncate text-sm text-muted-foreground">
                          {propOf(u?.propertyId)?.name} · <b className="font-semibold text-foreground">{u?.label}</b>
                        </p>
                      </div>
                      {late.length > 0 ? (
                        <Badge variant="negative">{late.length} ay gecikmiş</Badge>
                      ) : cur ? (
                        <RentStatusBadge status={cur.status} />
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span>
                        <Money value={expectedRent(l, month)} className="font-semibold" /> <span className="text-muted-foreground">/ ay</span>
                      </span>
                      {t?.phone && (
                        <span className="inline-flex select-all items-center gap-1 text-muted-foreground">
                          <Phone className="size-3.5" /> {t.phone}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3" /> {formatDate(l.startDate)} – {formatDate(l.endDate)}
                      </span>
                      <span className={cn(daysLeft < 60 && 'font-medium text-warning')}>{daysLeft < 0 ? 'Süresi doldu' : `${daysLeft} gün kaldı`}</span>
                    </div>

                    {late.length > 0 && (
                      <p className="mt-3 rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">
                        Toplam <Money value={lateTotal} className="font-semibold" /> borcu var ({late.map((c) => monthLabel(c.month)).join(', ')}).
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                      <Button size="sm" variant={late.length || cur?.status !== 'odendi' ? 'default' : 'outline'} onClick={() => openPayment(l)}>
                        <Banknote /> {can.add ? 'Kira aldım' : 'Ödemeler'}
                      </Button>
                      {can.edit && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditLease(l)}>
                            <Pencil /> Düzenle
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => askConfirm(`${t?.name} ile sözleşme sonlandırılsın mı? Geçmiş ödemeler saklanır.`, () => upsert('leases', { ...l, active: false }))}
                          >
                            Çıkış
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editLease} onOpenChange={(o) => !o && setEditLease(null)}>
        <DialogContent title="Kiracıyı düzenle" description={editLease ? tenantOf(editLease.tenantId)?.name : ''}>
          {editLease && (
            <TenantForm key={editLease.id} lease={editLease} tenant={tenantOf(editLease.tenantId)} onDone={() => setEditLease(null)} />
          )}
        </DialogContent>
      </Dialog>
      <RentPaymentDialog key={payTarget ? payTarget.leaseId + payTarget.month + payTarget.paid : 'none'} target={payTarget} onClose={() => setPayTarget(null)} />
    </>
  )
}
