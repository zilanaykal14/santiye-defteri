import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Banknote, CalendarClock, HardHat, Scale, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { Money, PageHeader, PartnerDot, StatCard } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { useSettlement, useToday } from '@/hooks/useFinance'
import { useCurrentUser } from '@/store/useAuthStore'
import { activeProjectsCost, leaseEndingSoon, monthlyFlows, projectTotals, spendingByProject } from '@/lib/metrics'
import { expectedRent, leaseCoversMonth, overdueRents } from '@/lib/rent'
import { dayDiff, formatDate, monthLabel } from '@/lib/dates'
import { formatTL, formatTLCompact } from '@/lib/money'
import { CATEGORY_LABEL, KIND_LABEL } from '@/lib/labels'

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function DashboardPage() {
  const { partners, projects, leases, rentPayments, transactions, units, tenants } = useAppStore()
  const { today, month } = useToday()
  const settlement = useSettlement()
  const primary = partners.find((p) => p.isPrimary)
  const me = useCurrentUser()
  const pMap = new Map(partners.map((p) => [p.id, p]))

  const activeLeases = leases.filter((l) => l.active)
  const rentThisMonth = activeLeases.filter((l) => leaseCoversMonth(l, month)).reduce((a, l) => a + expectedRent(l, month), 0)
  const collectedThisMonth = rentPayments.filter((p) => p.month === month).reduce((a, p) => a + p.amount, 0)
  const flows = useMemo(
    () => monthlyFlows(month, 12, activeLeases, rentPayments, transactions, primary?.id),
    [month, activeLeases, rentPayments, transactions, primary?.id],
  )
  const thisFlow = flows[flows.length - 1]
  const constructionCost = activeProjectsCost(projects, transactions)
  const primaryNet = settlement.totals.find((t) => t.partnerId === primary?.id)?.net ?? 0
  const overdue = overdueRents(activeLeases, rentPayments, today)
  const ending = leaseEndingSoon(activeLeases, today, 60)
  const primaryTransfers = settlement.transfers.filter((t) => t.toPartnerId === primary?.id || t.fromPartnerId === primary?.id)
  const overBudget = projects
    .filter((p) => p.status !== 'tamamlandi')
    .map((p) => ({ p, t: projectTotals(p, transactions) }))
    .flatMap(({ p, t }) =>
      (Object.keys(t.actualByCat) as (keyof typeof t.actualByCat)[])
        .filter((c) => p.budget[c] > 0 && t.actualByCat[c] / p.budget[c] > 0.9 && p.progress < 90)
        .map((c) => ({ p, c, ratio: t.actualByCat[c] / p.budget[c] })),
    )
  const pie = spendingByProject(projects, transactions)
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6)

  const leaseLabel = (leaseId: string) => {
    const l = leases.find((x) => x.id === leaseId)
    const u = units.find((x) => x.id === l?.unitId)
    const t = tenants.find((x) => x.id === l?.tenantId)
    return `${u?.label ?? ''} · ${t?.name ?? ''}`
  }
  const alertCount = overdue.length + ending.length + primaryTransfers.length + overBudget.length

  return (
    <>
      <PageHeader title={`Hoş geldin, ${(me?.name ?? '').split(/[ (]/)[0]}`} description={`${monthLabel(month, true)} itibarıyla portföy, şantiye ve ortaklık durumu`} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Aylık kira geliri"
          icon={Banknote}
          value={<Money value={rentThisMonth} />}
          sub={
            <>
              Tahsil edilen <Money value={collectedThisMonth} className="text-foreground" /> ·{' '}
              {rentThisMonth ? Math.round((collectedThisMonth / rentThisMonth) * 100) : 0}%
            </>
          }
        />
        <StatCard
          label="Süren inşaatlar · kümülatif maliyet"
          icon={HardHat}
          tone="brand"
          value={<Money value={constructionCost} />}
          sub={`${projects.filter((p) => p.status === 'devam').length} aktif proje`}
        />
        <StatCard
          label={`${primary?.name ?? 'Ana kişi'} · ortaklık net bakiyesi`}
          icon={Scale}
          tone={primaryNet >= 0 ? 'positive' : 'negative'}
          value={<Money value={primaryNet} signed />}
          sub={primaryNet >= 0 ? 'Ortaklardan alacaklı' : 'Ortaklara borçlu'}
        />
        <StatCard
          label="Bu ay net nakit akışı"
          icon={TrendingUp}
          tone={thisFlow.net >= 0 ? 'positive' : 'negative'}
          value={<Money value={thisFlow.net} signed />}
          sub={
            <>
              Kira tahsilatı − şahsi/mülk giderleri (<Money value={thisFlow.outflow} />)
            </>
          }
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Uyarılar */}
        <Card className="xl:col-span-1">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" /> Acil uyarılar
              </CardTitle>
              <CardDescription>{alertCount ? `${alertCount} konu ilgi bekliyor` : 'Her şey yolunda'}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            {overdue.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Geciken kiralar</h4>
                <ul className="grid gap-2">
                  {overdue.slice(0, 5).map((c) => (
                    <li key={c.leaseId + c.month} className="flex items-center justify-between gap-2 rounded-md bg-negative-bg/60 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{leaseLabel(c.leaseId)}</div>
                        <div className="text-xs text-muted-foreground">
                          {monthLabel(c.month, true)} · {c.daysLate} gün gecikme
                        </div>
                      </div>
                      <Money value={c.expected - c.paid} className="text-negative font-medium" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {primaryTransfers.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bekleyen ortak ödemeleri</h4>
                <ul className="grid gap-2">
                  {primaryTransfers.map((t) => {
                    const incoming = t.toPartnerId === primary?.id
                    return (
                      <li key={t.fromPartnerId + t.toPartnerId} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          {incoming ? (
                            <>
                              <PartnerDot partner={pMap.get(t.fromPartnerId)} /> → size ödeyecek
                            </>
                          ) : (
                            <>
                              Siz → <PartnerDot partner={pMap.get(t.toPartnerId)} />
                            </>
                          )}
                        </span>
                        <Money value={incoming ? t.amount : -t.amount} signed className="font-medium" />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {overBudget.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bütçe aşım riski</h4>
                <ul className="grid gap-1.5 text-sm">
                  {overBudget.map(({ p, c, ratio }) => (
                    <li key={p.id + c} className="flex justify-between gap-2">
                      <span className="truncate">
                        {p.name} · {CATEGORY_LABEL[c]}
                      </span>
                      <Badge variant={ratio > 1 ? 'negative' : 'warning'}>%{Math.round(ratio * 100)} harcandı</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {ending.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bitecek sözleşmeler (60 gün)</h4>
                <ul className="grid gap-1.5 text-sm">
                  {ending.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span className="truncate">{leaseLabel(l.id)}</span>
                      <Badge variant="info">
                        <CalendarClock className="size-3" /> {dayDiff(today, l.endDate)} gün
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {alertCount === 0 && <p className="text-sm text-muted-foreground">Geciken kira veya bekleyen ödeme yok.</p>}
          </CardContent>
        </Card>

        {/* Nakit akışı */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Aylık nakit akışı</CardTitle>
            <CardDescription>Kira tahsilatı ile şahsi/mülk giderleri — son 12 ay</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flows.map((f) => ({ ...f, label: monthLabel(f.month), outflowNeg: f.outflow }))} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis tickFormatter={formatTLCompact} tickLine={false} axisLine={false} fontSize={11} width={64} stroke="var(--muted-foreground)" />
                <Tooltip
                  formatter={(v) => formatTL(Number(v))}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--muted)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="rentCollected" name="Kira tahsilatı" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outflowNeg" name="Şahsi & mülk gideri" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Proje bazlı harcama dağılımı</CardTitle>
            <CardDescription>Ortak inşaat giderleri, toplam <Money value={pie.reduce((a, x) => a + x.value, 0)} /></CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="var(--card)">
                    {pie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatTL(Number(v))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {pie.map((x, i) => (
                <li key={x.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="truncate">{x.name}</span>
                  </span>
                  <Money value={x.value} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Son işlemler</CardTitle>
              <CardDescription>Defterdeki en son kayıtlar</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/islemler">
                Tümü <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.description}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(t.date)} · {KIND_LABEL[t.kind]}
                      {t.scope ? ` · ${t.scope === 'ortak' ? 'Ortak' : 'Şahsi'}` : ''} ·{' '}
                      {t.payer.kind === 'kasa' ? 'Ortak kasa' : pMap.get(t.payer.partnerId)?.name}
                    </div>
                  </div>
                  <Money value={t.kind === 'gider' ? -t.amount : t.amount} signed={t.kind !== 'mahsup'} className="font-medium" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
