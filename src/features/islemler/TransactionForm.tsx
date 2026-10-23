import * as React from 'react'
import { ArrowRight, Landmark, Wallet } from 'lucide-react'
import { Button, Field, Input, Segmented, Select, Textarea } from '@/components/ui'
import { Money } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import type { TxDraftDefaults } from '@/store/useUIStore'
import { todayISO } from '@/lib/dates'
import { CATEGORY_HINT, CATEGORY_LABEL, COST_CATEGORIES, PROPERTY_CATEGORIES } from '@/lib/labels'
import { formatTL, parseTL } from '@/lib/money'
import { transactionEffect } from '@/lib/settlement'
import { cn } from '@/lib/utils'
import type { ExpenseCategory, ExpenseScope, Payer, Transaction, TransactionKind } from '@/types'

type Context = 'proje' | 'mulk' | 'genel'

const KIND_OPTIONS: { value: TransactionKind; label: string; description: string }[] = [
  { value: 'gider', label: 'Gider', description: 'Fatura, hakediş, masraf' },
  { value: 'gelir', label: 'Gelir', description: 'Satış, kapora, diğer' },
  { value: 'sermaye', label: 'Sermaye', description: 'Ortak kasaya para' },
  { value: 'mahsup', label: 'Ortak ödemesi', description: 'Ortaktan ortağa' },
]

export function TransactionForm({
  defaults,
  editId,
  onDone,
}: {
  defaults?: TxDraftDefaults
  editId?: string | null
  onDone: (tx: Transaction) => void
}) {
  const { partners, projects, properties, transactions, addTransaction, upsert } = useAppStore()
  const primary = partners.find((p) => p.isPrimary)

  const [kind, setKind] = React.useState<TransactionKind>(defaults?.kind ?? 'gider')
  const [context, setContext] = React.useState<Context>(
    defaults?.propertyId ? 'mulk' : defaults?.projectId || projects.length ? 'proje' : 'genel',
  )
  const [projectId, setProjectId] = React.useState(defaults?.projectId ?? projects.find((p) => p.status !== 'tamamlandi')?.id ?? '')
  const [propertyId, setPropertyId] = React.useState(defaults?.propertyId ?? properties[0]?.id ?? '')
  // Zorunlu seçimler bilinçli olarak BOŞ başlar — kullanıcı açıkça seçmeli
  const [scope, setScope] = React.useState<ExpenseScope | ''>(defaults?.scope ?? '')
  const [payerKey, setPayerKey] = React.useState<string>(
    defaults?.payer ? (defaults.payer.kind === 'kasa' ? 'kasa' : defaults.payer.partnerId) : '',
  )
  const [receiverId, setReceiverId] = React.useState(defaults?.receiverPartnerId ?? '')
  const [ownerId, setOwnerId] = React.useState(defaults?.ownerPartnerId ?? primary?.id ?? '')
  const [category, setCategory] = React.useState<ExpenseCategory>(defaults?.category ?? 'malzeme')
  const [amountStr, setAmountStr] = React.useState(defaults?.amount ? String(defaults.amount / 100).replace('.', ',') : '')
  const [date, setDate] = React.useState(defaults?.date ?? todayISO())
  const [docNo, setDocNo] = React.useState(defaults?.docNo ?? '')
  const [description, setDescription] = React.useState(defaults?.description ?? '')
  const [vendor, setVendor] = React.useState(defaults?.vendor ?? '')
  const [hakedisNo, setHakedisNo] = React.useState(defaults?.progressPaymentNo ? String(defaults.progressPaymentNo) : '')
  const [submitted, setSubmitted] = React.useState(false)

  const project = projects.find((p) => p.id === projectId)
  const needsProject = kind === 'sermaye' || kind === 'mahsup' || context === 'proje'
  const effectiveContext: Context = kind === 'sermaye' || kind === 'mahsup' ? 'proje' : context
  const isProperty = effectiveContext === 'mulk'
  // Mülk portföyü kişiseldir: mülk giderleri her zaman şahsi
  const effectiveScope: ExpenseScope | '' = isProperty ? 'sahsi' : scope
  const categories = isProperty ? PROPERTY_CATEGORIES : effectiveContext === 'proje' ? [...COST_CATEGORIES, 'diger' as const] : (Object.keys(CATEGORY_LABEL) as ExpenseCategory[])

  React.useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveContext])

  const projectPartners = project
    ? project.shares.map((s) => partners.find((p) => p.id === s.partnerId)).filter((p): p is NonNullable<typeof p> => !!p)
    : partners
  const payerPartners = effectiveContext === 'proje' ? projectPartners : partners

  const amount = parseTL(amountStr)
  const payer: Payer | null = payerKey === 'kasa' ? { kind: 'kasa' } : payerKey ? { kind: 'ortak', partnerId: payerKey } : null

  const errors: Record<string, string> = {}
  if (!amount || amount <= 0) errors.amount = 'Geçerli bir tutar girin (örn. 100.000 veya 2.500,50).'
  if (!description.trim()) errors.description = 'Açıklama zorunlu.'
  if (needsProject && !project) errors.project = 'Proje seçin.'
  if (isProperty && !propertyId) errors.property = 'Mülk seçin.'
  if ((kind === 'gider' || kind === 'gelir') && !effectiveScope) errors.scope = 'Gider türünü seçin.'
  if (!payer) errors.payer = kind === 'gelir' ? 'Paranın nereye girdiğini seçin.' : 'Ödemeyi yapanı seçin.'
  if ((kind === 'sermaye' || kind === 'mahsup') && payer?.kind === 'kasa') errors.payer = 'Bir ortak seçin.'
  if (kind === 'mahsup' && (!receiverId || receiverId === payerKey)) errors.receiver = 'Parayı alan farklı bir ortak seçin.'
  const valid = Object.keys(errors).length === 0

  const draft: Transaction | null =
    amount && payer
      ? {
          id: 'draft',
          createdAt: '',
          kind,
          date,
          docNo: docNo.trim() || undefined,
          description: description.trim(),
          amount,
          scope: kind === 'gider' || kind === 'gelir' ? (effectiveScope || undefined) : undefined,
          category: kind === 'gider' || kind === 'gelir' ? category : undefined,
          vendor: vendor.trim() || undefined,
          progressPaymentNo: category === 'taseron' && hakedisNo ? Number(hakedisNo) : undefined,
          projectId: effectiveContext === 'proje' ? projectId || undefined : undefined,
          propertyId: isProperty ? propertyId : undefined,
          payer,
          receiverPartnerId: kind === 'mahsup' ? receiverId : undefined,
          ownerPartnerId: kind === 'gider' && effectiveScope === 'sahsi' ? ownerId || undefined : undefined,
        }
      : null

  const effect = draft && project && effectiveContext === 'proje' ? transactionEffect(draft, project) : null

  function submit(another: boolean) {
    setSubmitted(true)
    if (!valid || !draft) return
    const { id: _id, createdAt: _c, ...rest } = draft
    void _id
    void _c
    const original = editId ? transactions.find((t) => t.id === editId) : undefined
    let tx: Transaction
    if (original) {
      tx = { ...rest, id: original.id, createdAt: original.createdAt }
      upsert('transactions', tx)
      return onDone(tx)
    }
    tx = addTransaction(rest)
    if (another) {
      setAmountStr('')
      setDocNo('')
      setDescription('')
      setHakedisNo('')
      setSubmitted(false)
    } else onDone(tx)
  }

  const err = (k: string) => (submitted ? errors[k] : undefined)
  const partnerLabel = (id: string) => partners.find((p) => p.id === id)?.name ?? '—'

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
    >
      <Segmented value={kind} onChange={setKind} options={KIND_OPTIONS} className="max-sm:grid-cols-2!" />

      {/* Bağlam */}
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === 'gider' || kind === 'gelir' ? (
          <Field label="Bağlı olduğu yer">
            <Select value={context} onChange={(e) => setContext(e.target.value as Context)}>
              <option value="proje">İnşaat projesi</option>
              <option value="mulk">Mülk / kira portföyü</option>
              <option value="genel">Genel (projesiz)</option>
            </Select>
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
        {effectiveContext === 'proje' && (
          <Field label="Proje" error={err('project')}>
            <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setPayerKey('') }}>
              <option value="">Seçin…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {isProperty && (
          <Field label="Mülk" error={err('property')}>
            <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">Seçin…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {/* ZORUNLU SEÇİM 1: Gider türü */}
      {(kind === 'gider' || kind === 'gelir') && !isProperty && (
        <Field label={kind === 'gider' ? '1 · Gider türü' : '1 · Gelir türü'} error={err('scope')}>
          <Segmented
            value={scope as ExpenseScope}
            onChange={setScope}
            options={[
              {
                value: 'ortak',
                label: kind === 'gider' ? 'Ortak İnşaat Gideri' : 'Ortaklık Geliri',
                description: 'Hisse oranında ortaklara dağıtılır',
              },
              {
                value: 'sahsi',
                label: kind === 'gider' ? 'Şahsi / Kişisel Gider' : 'Şahsi Gelir',
                description: 'Tek kişiye aittir',
              },
            ]}
          />
        </Field>
      )}
      {isProperty && (
        <p className="-mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Mülk giderleri kişisel kira portföyüne yazılır (şahsi gider) ve ortaklık mahsuplaşmasına girmez.
        </p>
      )}

      {/* ZORUNLU SEÇİM 2: Ödeyen */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={
            kind === 'gelir' ? '2 · Para nereye girdi?' : kind === 'sermaye' ? '2 · Kasaya koyan ortak' : kind === 'mahsup' ? '2 · Parayı veren' : '2 · Ödemeyi yapan'
          }
          error={err('payer')}
        >
          <Select value={payerKey} onChange={(e) => setPayerKey(e.target.value)}>
            <option value="">Seçin…</option>
            {kind !== 'sermaye' && kind !== 'mahsup' && (
              <option value="kasa">{kind === 'gelir' ? 'Ortak kasaya / şirket hesabına' : 'Ortak kasa / şirket hesabı'}</option>
            )}
            {payerPartners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {kind === 'gider' ? ' — kendi cebinden' : kind === 'gelir' ? ' — kendi hesabına' : ''}
              </option>
            ))}
          </Select>
        </Field>
        {kind === 'mahsup' && (
          <Field label="Parayı alan" error={err('receiver')}>
            <Select value={receiverId} onChange={(e) => setReceiverId(e.target.value)}>
              <option value="">Seçin…</option>
              {projectPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === 'gider' && effectiveScope === 'sahsi' && (
          <Field label="Gider kime ait?" hint="Kasadan veya başka ortak ödediyse, sahibi borçlanır.">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {/* Tutar & detay */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tutar (₺)" error={err('amount')} hint={amount ? formatTL(amount) : undefined}>
          <Input inputMode="decimal" placeholder="100.000" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="num" />
        </Field>
        <Field label="Tarih">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Fiş / Fatura no">
          <Input value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="FTR-0001" />
        </Field>
      </div>

      {(kind === 'gider' || kind === 'gelir') && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kategori" hint={CATEGORY_HINT[category]}>
            <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={category === 'taseron' ? 'Taşeron' : 'Tedarikçi / Firma'}>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={category === 'taseron' ? 'Usta Kalıp' : 'Firma adı'} />
          </Field>
          {category === 'taseron' && kind === 'gider' && (
            <Field label="Hakediş no">
              <Input type="number" min={1} value={hakedisNo} onChange={(e) => setHakedisNo(e.target.value)} placeholder="1" />
            </Field>
          )}
        </div>
      )}

      <Field label="Açıklama" error={err('description')}>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Örn. İnşaat demiri Ø12 – 4 ton" />
      </Field>

      {/* ZORUNLU SEÇİM 3: Mahsuplaşma önizlemesi */}
      {effectiveContext === 'proje' && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Landmark className="size-4 text-primary" /> 3 · Mahsuplaşma etkisi (otomatik)
          </div>
          {!effect ? (
            <p className="text-xs text-muted-foreground">Proje, tutar ve ödeyen seçildiğinde ortakların borç/alacak etkisi burada görünür.</p>
          ) : effect.entries.length === 0 && effect.kasaDelta === 0 ? (
            <p className="text-xs text-muted-foreground">Bu işlem ortaklar arası bakiyeyi etkilemez (kişi kendi gideri için kendi cebinden ödüyor).</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {aggregate(effect.entries).map((e) => (
                <li key={e.partnerId} className="flex items-center justify-between gap-3">
                  <span className="truncate">{partnerLabel(e.partnerId)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{e.net >= 0 ? 'alacak' : 'borç'}</span>
                    <Money value={e.net} signed />
                  </span>
                </li>
              ))}
              {effect.kasaDelta !== 0 && (
                <li className="flex items-center justify-between gap-3 border-t pt-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="size-3.5" /> Ortak kasa
                  </span>
                  <Money value={effect.kasaDelta} signed />
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {!editId && (
          <Button type="button" variant="outline" onClick={() => submit(true)}>
            Kaydet & yeni ekle
          </Button>
        )}
        <Button type="submit" className={cn(submitted && !valid && 'animate-pulse')}>
          Kaydet <ArrowRight />
        </Button>
      </div>
    </form>
  )
}

function aggregate(entries: { partnerId: string; credit: number; debit: number }[]) {
  const m = new Map<string, number>()
  for (const e of entries) m.set(e.partnerId, (m.get(e.partnerId) ?? 0) + e.credit - e.debit)
  return [...m].map(([partnerId, net]) => ({ partnerId, net }))
}
