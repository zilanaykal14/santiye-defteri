import * as React from 'react'
import { Button, Dialog, DialogContent, Field, Input, Select, Textarea } from '@/components/ui'
import { Money } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { useCan } from '@/store/useAuthStore'
import { monthLabel, todayISO } from '@/lib/dates'
import { formatTL, parseTL } from '@/lib/money'
import type { Kurus, MonthKey } from '@/types'

// ─────────────── Kira tahsilatı ───────────────
export function RentPaymentDialog({
  target,
  onClose,
}: {
  target: { leaseId: string; month: MonthKey; expected: Kurus; paid: Kurus } | null
  onClose: () => void
}) {
  const { addRentPayment, rentPayments, remove } = useAppStore()
  const can = useCan()
  const remaining = target ? Math.max(0, target.expected - target.paid) : 0
  const [amountStr, setAmountStr] = React.useState(remaining ? String(remaining / 100) : '')
  const [date, setDate] = React.useState(todayISO())
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState('')
  const existing = target ? rentPayments.filter((p) => p.leaseId === target.leaseId && p.month === target.month) : []

  function save() {
    const amount = parseTL(amountStr)
    if (!target || !amount || amount <= 0) return setError('Geçerli bir tutar girin.')
    addRentPayment({ leaseId: target.leaseId, month: target.month, paidDate: date, amount, note: note || undefined })
    onClose()
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Kira tahsilatı" description={target ? `${monthLabel(target.month, true)} kirası` : ''} className="sm:max-w-md">
        {target && (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-center text-xs">
              <div>
                <div className="text-muted-foreground">Beklenen</div>
                <Money value={target.expected} className="text-sm font-medium" />
              </div>
              <div>
                <div className="text-muted-foreground">Ödenen</div>
                <Money value={target.paid} className="text-sm font-medium text-positive" />
              </div>
              <div>
                <div className="text-muted-foreground">Kalan</div>
                <Money value={remaining} className="text-sm font-medium text-negative" />
              </div>
            </div>
            {existing.length > 0 && (
              <ul className="grid gap-1 text-xs">
                {existing.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                    <span>
                      {p.paidDate} · <Money value={p.amount} /> {p.note && `· ${p.note}`}
                    </span>
                    {can.edit && (
                      <button className="text-negative hover:underline cursor-pointer" onClick={() => remove('rentPayments', p.id)}>
                        sil
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {remaining > 0 && can.add && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tahsil edilen (₺)" error={error} hint={parseTL(amountStr) ? formatTL(parseTL(amountStr)!) : undefined}>
                    <Input inputMode="decimal" className="num" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
                  </Field>
                  <Field label="Ödeme tarihi">
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                </div>
                <Field label="Not">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Havale, elden…" />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>Vazgeç</Button>
                  <Button onClick={save}>Tahsilatı kaydet</Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────── Mülk + bağımsız bölümler ───────────────
export function PropertyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addProperty, addUnit, projects } = useAppStore()
  const [f, setF] = React.useState({ name: '', address: '', ada: '', parsel: '', pafta: '', nitelik: '', projectId: '', units: '' })
  const [error, setError] = React.useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  function save() {
    if (!f.name.trim()) return setError('Mülk adı zorunlu.')
    const p = addProperty({
      name: f.name.trim(), address: f.address.trim(), projectId: f.projectId || undefined,
      deed: { ada: f.ada || undefined, parsel: f.parsel || undefined, pafta: f.pafta || undefined, nitelik: f.nitelik || undefined },
    })
    f.units.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).forEach((label) => addUnit({ propertyId: p.id, label }))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Yeni mülk" description="Adres, tapu bilgisi ve bağımsız bölümler">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mülk adı"><Input value={f.name} onChange={set('name')} placeholder="Çamlık Apartmanı" /></Field>
          <Field label="Bağlı proje (opsiyonel)">
            <Select value={f.projectId} onChange={set('projectId')}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Adres" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <Field label="Ada"><Input value={f.ada} onChange={set('ada')} /></Field>
            <Field label="Parsel"><Input value={f.parsel} onChange={set('parsel')} /></Field>
            <Field label="Pafta"><Input value={f.pafta} onChange={set('pafta')} /></Field>
          </div>
          <Field label="Nitelik"><Input value={f.nitelik} onChange={set('nitelik')} placeholder="Kargir apartman" /></Field>
          <Field label="Bağımsız bölümler" hint="Virgülle ayırın: A-1, A-2, Dükkan 1">
            <Textarea rows={2} value={f.units} onChange={set('units')} />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-negative">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={save}>Kaydet</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
