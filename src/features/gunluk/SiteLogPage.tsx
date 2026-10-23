import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowRight, CalendarDays, HardHat, NotebookPen, Plus, Trash2, Users, Wallet, X } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, Textarea } from '@/components/ui'
import { EmptyState, Money, PageHeader, PartnerDot } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { useCan } from '@/store/useAuthStore'
import { useToday } from '@/hooks/useFinance'
import { dayDiff, formatDate } from '@/lib/dates'
import { CATEGORY_LABEL, COST_CATEGORIES } from '@/lib/labels'
import { formatTL, parseTL } from '@/lib/money'
import { transactionEffect } from '@/lib/settlement'
import { cn } from '@/lib/utils'
import type { CostCategory, ID, Partner, Project, SiteLog, Transaction } from '@/types'

interface Row {
  key: number
  description: string
  amount: string
  payer: string
  category: CostCategory
}
let rowSeq = 0
const emptyRow = (): Row => ({ key: ++rowSeq, description: '', amount: '', payer: '', category: 'malzeme' })

const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'long' })

export function SiteLogPage() {
  const { projects, partners, siteLogs, transactions, users } = useAppStore()
  const [params, setParams] = useSearchParams()
  const active = projects.filter((p) => p.status !== 'tamamlandi')
  const projectId = params.get('proje') ?? active[0]?.id ?? projects[0]?.id
  const project = projects.find((p) => p.id === projectId)
  const can = useCan()
  const formRef = React.useRef<HTMLDivElement>(null)
  const [formDate, setFormDate] = React.useState<string | null>(null)
  const [shown, setShown] = React.useState(12)
  const { today } = useToday()

  if (!project) {
    return (
      <>
        <PageHeader title="Şantiye Günlüğü" />
        <EmptyState icon={HardHat} title="Henüz inşaat projesi yok">
          Önce <Link to="/insaatlar" className="text-primary underline">İnşaatlar</Link> sayfasından bir proje ekleyin.
        </EmptyState>
      </>
    )
  }

  const pMap = new Map(partners.map((p) => [p.id, p]))
  const uMap = new Map(users.map((u) => [u.id, u]))
  const logs = siteLogs.filter((l) => l.projectId === project.id)
  const txs = transactions.filter((t) => t.projectId === project.id)
  const dates = [...new Set([...logs.map((l) => l.date), ...txs.map((t) => t.date)])].sort((a, b) => b.localeCompare(a))
  const totalSpent = txs.filter((t) => t.kind === 'gider' && t.scope === 'ortak').reduce((a, t) => a + t.amount, 0)
  const dayNo = (d: string) => dayDiff(project.startDate, d) + 1

  return (
    <>
      <PageHeader
        title="Şantiye Günlüğü"
        description="Gün gün ne oldu, ne harcandı, kim ödedi"
        actions={
          can.see('mahsuplasma') && (
            <Button asChild variant="outline">
              <Link to={`/mahsuplasma?proje=${project.id}`}>
                Ortak hesabı <ArrowRight />
              </Link>
            </Button>
          )
        }
      />

      {/* Proje seçimi */}
      <div className="mb-5 flex flex-wrap gap-2">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setParams({ proje: p.id })}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
              p.id === project.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 min-w-0 xl:order-1">
          {/* Özet şeridi */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Başlangıç</p>
              <p className="mt-1 font-semibold">{formatDate(project.startDate)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Bugün</p>
              <p className="mt-1 font-semibold">{Math.max(1, dayNo(today))}. gün</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Toplam harcanan</p>
              <Money value={totalSpent} className="mt-1 block font-semibold" />
            </Card>
          </div>

          {dates.length === 0 ? (
            <EmptyState icon={NotebookPen} title="Bu proje için henüz kayıt yok">İlk günü sağdaki formdan yazın.</EmptyState>
          ) : (
            <ol className="relative grid gap-4">
              {dates.slice(0, shown).map((d) => (
                <DayCard
                  key={d}
                  date={d}
                  dayNo={dayNo(d)}
                  logs={logs.filter((l) => l.date === d)}
                  txs={txs.filter((t) => t.date === d).sort((a, b) => a.createdAt.localeCompare(b.createdAt))}
                  pMap={pMap}
                  authorName={(id?: ID) => (id ? uMap.get(id)?.name : undefined)}
                  canEdit={can.edit}
                  onAdd={
                    can.add
                      ? () => {
                          setFormDate(d)
                          formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      : undefined
                  }
                />
              ))}
              {dates.length > shown && (
                <li className="flex justify-center">
                  <Button variant="outline" onClick={() => setShown(shown + 20)}>
                    Önceki günleri göster ({dates.length - shown} gün daha)
                  </Button>
                </li>
              )}
            </ol>
          )}
        </div>

        <div ref={formRef} className="order-1 min-w-0 xl:order-2">
          {can.add ? (
            <DayEntryForm key={project.id + (formDate ?? '')} project={project} partners={partners} initialDate={formDate ?? undefined} />
          ) : (
            <Card className="p-5 text-sm text-muted-foreground">Bu hesapla kayıt eklenemiyor. Yöneticinizden ekleme yetkisi isteyin.</Card>
          )}
        </div>
      </div>
    </>
  )
}

function DayCard({
  date, dayNo, logs, txs, pMap, authorName, canEdit, onAdd,
}: {
  date: string
  dayNo: number
  logs: SiteLog[]
  txs: Transaction[]
  pMap: Map<ID, Partner>
  authorName: (id?: ID) => string | undefined
  canEdit: boolean
  onAdd?: () => void
}) {
  const remove = useAppStore((s) => s.remove)
  const spent = txs.filter((t) => t.kind === 'gider').reduce((a, t) => a + t.amount, 0)
  const payer = (t: Transaction) => (t.payer.kind === 'kasa' ? undefined : pMap.get(t.payer.partnerId))

  return (
    <li>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-sidebar px-2.5 py-1 text-xs font-bold text-sidebar-foreground">
              {dayNo > 0 ? `${dayNo}. Gün` : 'Başlangıç öncesi'}
            </span>
            <span className="text-sm font-medium">{formatDate(date)}</span>
            <span className="text-sm capitalize text-muted-foreground">{weekday(date)}</span>
          </div>
          <div className="flex items-center gap-2">
            {spent > 0 && (
              <span className="text-sm text-muted-foreground">
                Gün toplamı <Money value={spent} className="font-semibold text-foreground" />
              </span>
            )}
            {onAdd && (
              <Button variant="ghost" size="sm" onClick={onAdd} aria-label="Bu güne ekle">
                <Plus />
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-3 p-4">
          {logs.map((l) => (
            <div key={l.id} className="group flex gap-3">
              <NotebookPen className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed">{l.note}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {l.workers ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" /> {l.workers} işçi
                    </span>
                  ) : null}
                  {authorName(l.createdBy) && <span>Yazan: {authorName(l.createdBy)}</span>}
                </p>
              </div>
              {canEdit && (
                <button
                  className="h-fit rounded p-1 text-muted-foreground opacity-0 hover:text-negative group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                  onClick={() => askConfirm('Bu günlük notu silinsin mi?', () => remove('siteLogs', l.id))}
                  aria-label="Notu sil"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          {txs.length > 0 && (
            <ul className={cn('grid gap-2', logs.length > 0 && 'border-t pt-3')}>
              {txs.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {t.kind === 'sermaye' ? 'Kasaya sermaye' : t.kind === 'mahsup' ? 'Ortaklar arası ödeme' : t.description}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {t.kind === 'gider' && (
                        <>
                          {payer(t) ? <PartnerDot partner={payer(t)} className="font-medium text-foreground" /> : <span className="inline-flex items-center gap-1 font-medium text-foreground"><Wallet className="size-3" /> Ortak kasa</span>}
                          <span>ödedi</span>
                          {t.category && <Badge variant="outline">{CATEGORY_LABEL[t.category]}</Badge>}
                          {t.scope === 'sahsi' && <Badge variant="warning">Şahsi</Badge>}
                        </>
                      )}
                      {t.kind === 'sermaye' && (
                        <>
                          <PartnerDot partner={payer(t)} className="font-medium text-foreground" /> kasaya koydu
                        </>
                      )}
                      {t.kind === 'gelir' && (
                        <>
                          <ArrowDownLeft className="size-3" /> {payer(t) ? `${payer(t)?.name} tahsil etti` : 'Kasaya girdi'} · {t.description}
                        </>
                      )}
                      {t.kind === 'mahsup' && (
                        <>
                          <PartnerDot partner={payer(t)} /> → <PartnerDot partner={t.receiverPartnerId ? pMap.get(t.receiverPartnerId) : undefined} />
                        </>
                      )}
                    </div>
                  </div>
                  <Money
                    value={t.kind === 'gider' ? -t.amount : t.amount}
                    signed={t.kind === 'gider' || t.kind === 'gelir'}
                    className="font-semibold"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </li>
  )
}

function DayEntryForm({ project, partners, initialDate }: { project: Project; partners: Partner[]; initialDate?: string }) {
  const { addSiteLog, addTransaction } = useAppStore()
  const { today } = useToday()
  const [date, setDate] = React.useState(initialDate ?? today)
  const [note, setNote] = React.useState('')
  const [workers, setWorkers] = React.useState('')
  const [rows, setRows] = React.useState<Row[]>([emptyRow()])
  const [error, setError] = React.useState('')
  const [saved, setSaved] = React.useState(false)

  const projectPartners = project.shares.map((s) => partners.find((p) => p.id === s.partnerId)).filter((p): p is Partner => !!p)
  const filled = rows.filter((r) => r.description.trim() || r.amount.trim())
  const setRow = (key: number, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const dayNo = dayDiff(project.startDate, date) + 1

  // Taslak gider kayıtları → anlık mahsuplaşma etkisi
  const drafts: Transaction[] = filled.flatMap((r, i) => {
    const amount = parseTL(r.amount)
    if (!amount || !r.payer) return []
    return [{
      id: `d${i}`, createdAt: '', kind: 'gider', scope: 'ortak', category: r.category, date,
      description: r.description, amount, projectId: project.id,
      payer: r.payer === 'kasa' ? { kind: 'kasa' } : { kind: 'ortak', partnerId: r.payer },
    } satisfies Transaction]
  })
  const effect = new Map<ID, number>()
  for (const d of drafts) for (const e of transactionEffect(d, project).entries) effect.set(e.partnerId, (effect.get(e.partnerId) ?? 0) + e.credit - e.debit)
  const total = drafts.reduce((a, d) => a + d.amount, 0)

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!note.trim() && filled.length === 0) return setError('Bir not yazın veya en az bir gider girin.')
    for (const r of filled) {
      if (!r.description.trim()) return setError('Her gider satırına ne olduğunu yazın.')
      if (!parseTL(r.amount)) return setError(`"${r.description}" için geçerli bir tutar girin.`)
      if (!r.payer) return setError(`"${r.description}" için kimin ödediğini seçin.`)
    }
    if (note.trim()) addSiteLog({ projectId: project.id, date, note: note.trim(), workers: workers ? Number(workers) : undefined })
    for (const d of drafts) {
      const { id: _i, createdAt: _c, ...rest } = d
      void _i
      void _c
      addTransaction(rest)
    }
    setNote('')
    setWorkers('')
    setRows([emptyRow()])
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-brand" /> Günlük kaydı yaz
        </CardTitle>
        <CardDescription>{project.name} · {dayNo > 0 ? `${dayNo}. gün` : 'başlangıç öncesi'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <Field label="Tarih">
              <Input id="log-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="İşçi sayısı">
              <Input id="log-workers" type="number" min={0} value={workers} onChange={(e) => setWorkers(e.target.value)} placeholder="—" />
            </Field>
          </div>
          <Field label="Bugün ne oldu?">
            <Textarea id="log-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. İnşaat başladı, temel kazısı yapıldı." />
          </Field>

          <div className="grid gap-2">
            <p className="text-[13px] font-medium">Bugünün giderleri</p>
            {rows.map((r, i) => (
              <div key={r.key} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex gap-2">
                  <Input
                    id={`row-desc-${i}`}
                    value={r.description}
                    onChange={(e) => setRow(r.key, { description: e.target.value })}
                    placeholder="Ne alındı / ödendi? (ör. Hazır beton)"
                  />
                  {rows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} aria-label="Satırı kaldır">
                      <X />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input id={`row-amt-${i}`} inputMode="decimal" className="num" value={r.amount} onChange={(e) => setRow(r.key, { amount: e.target.value })} placeholder="Tutar ₺" />
                  <Select id={`row-payer-${i}`} value={r.payer} onChange={(e) => setRow(r.key, { payer: e.target.value })} className={cn(!r.payer && 'text-muted-foreground')}>
                    <option value="">Kim ödedi?</option>
                    {projectPartners.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="kasa">Ortak kasa</option>
                  </Select>
                </div>
                <Select id={`row-cat-${i}`} value={r.category} onChange={(e) => setRow(r.key, { category: e.target.value as CostCategory })}>
                  {COST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </Select>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, emptyRow()])} className="justify-self-start">
              <Plus /> Gider satırı ekle
            </Button>
          </div>

          {drafts.length > 0 && (
            <div className="rounded-lg border border-primary/25 bg-accent/50 p-3 text-sm">
              <div className="mb-1.5 flex justify-between font-medium">
                <span>Ortaklara etkisi</span>
                <span className="num">{formatTL(total)}</span>
              </div>
              <ul className="grid gap-1">
                {[...effect].map(([pid, v]) => (
                  <li key={pid} className="flex justify-between gap-2 text-xs">
                    <span className="truncate">{partners.find((p) => p.id === pid)?.name}</span>
                    <span>
                      <span className="text-muted-foreground">{v >= 0 ? 'alacaklı ' : 'borçlu '}</span>
                      <Money value={v} signed />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-negative">{error}</p>}
          {saved && <p className="text-sm text-positive">Kaydedildi.</p>}
          <Button type="submit" variant="brand" size="lg">
            Günü kaydet
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
