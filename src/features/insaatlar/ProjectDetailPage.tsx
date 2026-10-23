import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, NotebookPen, Pencil, Plus, Wallet } from 'lucide-react'
import { useCan } from '@/store/useAuthStore'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress,
  Table, TBody, TD, TFoot, TH, THead, TR, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui'
import { EmptyState, Money, PageHeader, PartnerDot, StatCard } from '@/components/shared'
import { DataTable } from '@/components/shared/DataTable'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { useUIStore } from '@/store/useUIStore'
import { useSettlement } from '@/hooks/useFinance'
import { projectCostTxs, projectTotals } from '@/lib/metrics'
import { CATEGORY_COLOR, CATEGORY_LABEL, COST_CATEGORIES, PROJECT_STATUS_LABEL } from '@/lib/labels'
import { allocate, formatTL, formatTLCompact } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { transactionColumns } from '@/features/islemler/columns'
import { ProjectFormDialog } from './ProjectFormDialog'
import { Banknote, HardHat, PiggyBank, Target } from 'lucide-react'

export function ProjectDetailPage() {
  const { id } = useParams()
  const { projects, transactions, partners, properties, remove } = useAppStore()
  const openTx = useUIStore((s) => s.openTxDialog)
  const settlement = useSettlement()
  const [editOpen, setEditOpen] = React.useState(false)
  const can = useCan()
  const project = projects.find((p) => p.id === id)

  if (!project) {
    return (
      <EmptyState icon={HardHat} title="Proje bulunamadı">
        <Link to="/insaatlar" className="text-primary underline">
          İnşaatlara dön
        </Link>
      </EmptyState>
    )
  }

  const pMap = new Map(partners.map((p) => [p.id, p]))
  const t = projectTotals(project, transactions)
  const ps = settlement.perProject.find((x) => x.projectId === project.id)!
  const costTxs = projectCostTxs(project.id, transactions)
  const allTxs = transactions.filter((x) => x.projectId === project.id)
  const hakedis = costTxs.filter((x) => x.category === 'taseron')
  const byVendor = Object.entries(
    hakedis.reduce<Record<string, typeof hakedis>>((acc, x) => {
      const k = x.vendor || 'Belirtilmemiş'
      ;(acc[k] ??= []).push(x)
      return acc
    }, {}),
  )
  const shareCost = allocate(t.actual, project.shares.map((s) => s.shareBps))
  const chartData = COST_CATEGORIES.map((c) => ({
    name: CATEGORY_LABEL[c],
    Bütçe: project.budget[c],
    Gerçekleşen: t.actualByCat[c],
  }))

  const columns = transactionColumns({
    partners: pMap,
    projects: new Map(projects.map((p) => [p.id, p])),
    properties: new Map(properties.map((p) => [p.id, p])),
    hideContext: true,
    onEdit: (tx) => {
      const { id: txId, createdAt: _c, ...rest } = tx
      void _c
      openTx(rest, txId)
    },
    onDelete: (tx) => askConfirm(`"${tx.description}" silinsin mi?`, () => { remove('transactions', tx.id) }),
  })

  return (
    <>
      <Link to="/insaatlar" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> İnşaatlar
      </Link>
      <PageHeader
        title={project.name}
        description={`${project.location} · ${PROJECT_STATUS_LABEL[project.status]} · Başlangıç ${formatDate(project.startDate)}`}
        actions={
          <>
            {can.see('gunluk') && (
              <Button asChild variant="outline">
                <Link to={`/gunluk?proje=${project.id}`}>
                  <NotebookPen /> Günlük
                </Link>
              </Button>
            )}
            {can.edit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Düzenle
              </Button>
            )}
            {can.add && (
              <Button onClick={() => openTx({ projectId: project.id, kind: 'gider' })}>
                <Plus /> Gider ekle
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gerçekleşen maliyet" icon={Banknote} value={<Money value={t.actual} />} sub={<>Bütçe <Money value={t.budget} /></>} />
        <StatCard
          label="Bütçe kullanımı"
          icon={Target}
          tone={t.ratio > 1 ? 'negative' : t.ratio * 100 > project.progress + 15 ? 'warning' : 'positive'}
          value={<span className="num">%{Math.round(t.ratio * 100)}</span>}
          sub={`Fiziksel ilerleme %${project.progress}`}
        />
        <StatCard label="Kalan bütçe" icon={PiggyBank} value={<Money value={t.budget - t.actual} signed />} />
        <StatCard label="Ortak kasa bakiyesi" icon={Wallet} tone={ps.kasaBalance < 0 ? 'negative' : 'default'} value={<Money value={ps.kasaBalance} />} sub="Sermaye + kasaya giren gelir − kasadan ödenen" />
      </div>

      <Tabs defaultValue="ozet" className="mt-6">
        <TabsList>
          <TabsTrigger value="ozet">Bütçe vs. Gerçekleşen</TabsTrigger>
          <TabsTrigger value="giderler">Giderler ({allTxs.length})</TabsTrigger>
          <TabsTrigger value="hakedis">Hakedişler</TabsTrigger>
          <TabsTrigger value="hisse">Hisse dağılımı</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet">
          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Kategori bazlı maliyet</CardTitle>
                <CardDescription>Öngörülen bütçe ile fiili harcama</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" interval={0} tickFormatter={(v: string) => v.split(/[ ,]/)[0]} />
                    <YAxis tickFormatter={formatTLCompact} tickLine={false} axisLine={false} fontSize={11} width={64} stroke="var(--muted-foreground)" />
                    <Tooltip formatter={(v) => formatTL(Number(v))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--muted)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Bütçe" fill="var(--muted-foreground)" fillOpacity={0.35} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Gerçekleşen" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Sapma tablosu</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {COST_CATEGORIES.map((c) => {
                  const b = project.budget[c]
                  const a = t.actualByCat[c]
                  const r = b ? (a / b) * 100 : 0
                  return (
                    <div key={c} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-sm" style={{ background: CATEGORY_COLOR[c] }} />
                          {CATEGORY_LABEL[c]}
                        </span>
                        <span className="num text-xs text-muted-foreground">%{Math.round(r)}</span>
                      </div>
                      <Progress value={r} tone={r > 100 ? 'negative' : r > 90 ? 'warning' : 'positive'} />
                      <div className="flex justify-between text-xs">
                        <Money value={a} />
                        <span className="text-muted-foreground">
                          Kalan <Money value={b - a} signed />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="giderler">
          <DataTable
            data={allTxs}
            columns={columns}
            initialSorting={[{ id: 'date', desc: true }]}
            searchPlaceholder="Açıklama, fatura no, tedarikçi…"
          />
        </TabsContent>

        <TabsContent value="hakedis">
          {byVendor.length === 0 ? (
            <EmptyState icon={HardHat} title="Taşeron hakedişi yok">Gider eklerken kategori olarak "Taşeron & İşçilik" seçin.</EmptyState>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {byVendor.map(([vendor, list]) => (
                <Card key={vendor}>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>{vendor}</CardTitle>
                    <Money value={list.reduce((a, x) => a + x.amount, 0)} className="font-semibold" />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <THead>
                        <TR>
                          <TH>No</TH>
                          <TH>Tarih</TH>
                          <TH>Açıklama</TH>
                          <TH className="text-right">Tutar</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {[...list].sort((a, b) => a.date.localeCompare(b.date)).map((x) => (
                          <TR key={x.id}>
                            <TD>{x.progressPaymentNo ? <Badge variant="outline">#{x.progressPaymentNo}</Badge> : '—'}</TD>
                            <TD className="num text-xs">{formatDate(x.date)}</TD>
                            <TD className="text-xs">{x.description}</TD>
                            <TD className="text-right">
                              <Money value={x.amount} />
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hisse">
          <Card>
            <CardHeader>
              <CardTitle>Hisse bazlı dağılım</CardTitle>
              <CardDescription>
                Her ortağın hissesine düşen maliyet, fiilen ödediği ve net durumu. Detaylı cari hesap için{' '}
                <Link to={`/mahsuplasma?proje=${project.id}`} className="text-primary underline">
                  Mahsuplaşma
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ps.shareError && <p className="mb-3 rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">{ps.shareError}</p>}
              <Table>
                <THead>
                  <TR>
                    <TH>Ortak</TH>
                    <TH className="text-right">Hisse</TH>
                    <TH className="text-right">Maliyetten payı</TH>
                    <TH className="text-right">Cebinden + sermaye</TH>
                    <TH className="text-right">Hissesine düşen</TH>
                    <TH className="text-right">Net (kasa payı dahil)</TH>
                  </TR>
                </THead>
                <TBody>
                  {project.shares.map((s, i) => {
                    const b = ps.balances.find((x) => x.partnerId === s.partnerId)
                    return (
                      <TR key={s.partnerId}>
                        <TD>
                          <PartnerDot partner={pMap.get(s.partnerId)} />
                        </TD>
                        <TD className="num text-right">%{s.shareBps / 100}</TD>
                        <TD className="text-right"><Money value={shareCost[i]} /></TD>
                        <TD className="text-right"><Money value={b?.paid ?? 0} /></TD>
                        <TD className="text-right"><Money value={b?.share ?? 0} /></TD>
                        <TD className="text-right font-medium"><Money value={b?.net ?? 0} signed /></TD>
                      </TR>
                    )
                  })}
                </TBody>
                <TFoot>
                  <TR>
                    <TD>Toplam</TD>
                    <TD className="num text-right">%{project.shares.reduce((a, s) => a + s.shareBps, 0) / 100}</TD>
                    <TD className="text-right"><Money value={t.actual} /></TD>
                    <TD className="text-right"><Money value={ps.balances.reduce((a, b) => a + b.paid, 0)} /></TD>
                    <TD className="text-right"><Money value={ps.balances.reduce((a, b) => a + b.share, 0)} /></TD>
                    <TD className="text-right"><Money value={ps.balances.reduce((a, b) => a + b.net, 0)} signed /></TD>
                  </TR>
                </TFoot>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ProjectFormDialog key={String(editOpen)} open={editOpen} onOpenChange={setEditOpen} project={project} />
    </>
  )
}
