import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { addDays, formatDate, todayISO } from '@/lib/dates'
import { formatTL, parseTL } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { IncreasePeriod, Lease, Tenant } from '@/types'

const NEW = '__yeni'

function addYears(d: string, years: number) {
  const [y, m, day] = d.split('-').map(Number)
  const next = `${y + years}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return addDays(next, -1)
}

/**
 * Sade kiracı formu: 6 temel alan, gerisi "Daha fazla seçenek" altında.
 * Boş daire yoksa formdan yeni daire (ve gerekirse yeni bina) eklenebilir.
 */
export function TenantForm({ tenant, lease, onDone }: { tenant?: Tenant; lease?: Lease; onDone?: () => void }) {
  const { units, properties, leases, upsert, addProperty, addUnit, addTenantWithLease } = useAppStore()
  const editing = !!lease
  const occupied = new Set(leases.filter((l) => l.active && l.id !== lease?.id).map((l) => l.unitId))
  const freeUnits = units.filter((u) => !occupied.has(u.id))

  const [name, setName] = React.useState(tenant?.name ?? '')
  const [phone, setPhone] = React.useState(tenant?.phone ?? '')
  const [unitId, setUnitId] = React.useState(lease?.unitId ?? freeUnits[0]?.id ?? NEW)
  const [propId, setPropId] = React.useState(properties[0]?.id ?? NEW)
  const [newProp, setNewProp] = React.useState('')
  const [newUnit, setNewUnit] = React.useState('')
  const [rent, setRent] = React.useState(lease ? String(lease.monthlyRent / 100) : '')
  const [start, setStart] = React.useState(lease?.startDate ?? todayISO())
  const [years, setYears] = React.useState('1')
  const [endDate, setEndDate] = React.useState(lease?.endDate ?? '')
  const [more, setMore] = React.useState(editing)
  const [deposit, setDeposit] = React.useState(lease ? String(lease.deposit / 100) : '')
  const [dueDay, setDueDay] = React.useState(lease ? String(lease.dueDay) : '')
  const [period, setPeriod] = React.useState<IncreasePeriod>(lease?.increasePeriod ?? 'yillik')
  const [rate, setRate] = React.useState(lease ? String(lease.increaseRateBps / 100) : '25')
  const [email, setEmail] = React.useState(tenant?.email ?? '')
  const [error, setError] = React.useState('')
  const [saved, setSaved] = React.useState('')

  const rentK = parseTL(rent)
  const computedEnd = editing ? endDate : addYears(start, Number(years))
  const defaultDue = Math.min(28, Number(start.slice(8, 10)) || 1)

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Kiracının adını yazın.')
    if (!rentK) return setError('Aylık kira tutarını yazın (ör. 15.000).')
    if (unitId === NEW) {
      if (!newUnit.trim()) return setError('Yeni dairenin numarasını yazın (ör. A-5).')
      if (propId === NEW && !newProp.trim()) return setError('Yeni binanın adını yazın.')
    }
    if (!computedEnd || computedEnd <= start) return setError('Bitiş tarihi başlangıçtan sonra olmalı.')

    let finalUnit = unitId
    if (unitId === NEW) {
      const pid = propId === NEW ? addProperty({ name: newProp.trim(), address: '', deed: {} }).id : propId
      finalUnit = addUnit({ propertyId: pid, label: newUnit.trim() }).id
    }
    const leaseData = {
      unitId: finalUnit,
      startDate: start,
      endDate: computedEnd,
      monthlyRent: rentK,
      deposit: parseTL(deposit) ?? rentK * 2,
      dueDay: Math.min(28, Math.max(1, Number(dueDay) || defaultDue)),
      increasePeriod: period,
      increaseRateBps: Math.round((Number(rate.replace(',', '.')) || 0) * 100),
      active: true,
    }
    const tenantData = { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined }

    if (editing && tenant && lease) {
      upsert('tenants', { ...tenant, ...tenantData })
      upsert('leases', { ...lease, ...leaseData })
      onDone?.()
      return
    }
    addTenantWithLease(tenantData, leaseData)
    setSaved(`${tenantData.name} eklendi.`)
    setName('')
    setPhone('')
    setRent('')
    setDeposit('')
    setNewUnit('')
    setEmail('')
    setUnitId(freeUnits.find((u) => u.id !== finalUnit)?.id ?? NEW)
    setTimeout(() => setSaved(''), 3000)
    onDone?.()
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad soyad">
          <Input id="tf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayşe Kaya" />
        </Field>
        <Field label="Telefon">
          <Input id="tf-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
        </Field>
      </div>

      <Field label="Hangi daire?">
        <Select id="tf-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {properties.map((p) => {
            const list = units.filter((u) => u.propertyId === p.id)
            if (!list.length) return null
            return (
              <optgroup key={p.id} label={p.name}>
                {list.map((u) => (
                  <option key={u.id} value={u.id} disabled={occupied.has(u.id)}>
                    {u.label}
                    {occupied.has(u.id) ? ' (dolu)' : ''}
                  </option>
                ))}
              </optgroup>
            )
          })}
          <option value={NEW}>+ Listede yok, yeni daire ekle</option>
        </Select>
      </Field>

      {unitId === NEW && (
        <div className="grid gap-3 rounded-lg border border-dashed bg-muted/40 p-3 sm:grid-cols-2">
          <Field label="Bina / mülk">
            <Select id="tf-prop" value={propId} onChange={(e) => setPropId(e.target.value)}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value={NEW}>+ Yeni bina</option>
            </Select>
          </Field>
          {propId === NEW ? (
            <Field label="Yeni bina adı">
              <Input id="tf-newprop" value={newProp} onChange={(e) => setNewProp(e.target.value)} placeholder="Çamlık Apartmanı" />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Field label="Daire no">
            <Input id="tf-newunit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="A-5" />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Aylık kira (₺)" hint={rentK ? formatTL(rentK) : undefined}>
          <Input id="tf-rent" inputMode="decimal" className="num" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="15.000" />
        </Field>
        <Field label="Başlangıç">
          <Input id="tf-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        {editing ? (
          <Field label="Bitiş">
            <Input id="tf-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        ) : (
          <Field label="Süre" hint={computedEnd ? `Bitiş: ${formatDate(computedEnd)}` : undefined}>
            <Select id="tf-years" value={years} onChange={(e) => setYears(e.target.value)}>
              <option value="1">1 yıl</option>
              <option value="2">2 yıl</option>
              <option value="3">3 yıl</option>
            </Select>
          </Field>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMore(!more)}
        className="flex items-center gap-1.5 justify-self-start text-sm font-medium text-primary cursor-pointer"
        aria-expanded={more}
      >
        <ChevronDown className={cn('size-4 transition-transform', more && 'rotate-180')} />
        Daha fazla seçenek (depozito, ödeme günü, artış)
      </button>

      {more && (
        <div className="grid gap-4 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
          <Field label="Depozito (₺)" hint={!deposit && rentK ? `Boş kalırsa: ${formatTL(rentK * 2)} (2 kira)` : undefined}>
            <Input id="tf-deposit" inputMode="decimal" className="num" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </Field>
          <Field label="Ödeme günü (her ayın)" hint={!dueDay ? `Boş kalırsa: ${defaultDue}` : undefined}>
            <Input id="tf-due" type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          </Field>
          <Field label="Kira artışı">
            <Select id="tf-period" value={period} onChange={(e) => setPeriod(e.target.value as IncreasePeriod)}>
              <option value="yillik">Yılda bir</option>
              <option value="alti_aylik">6 ayda bir</option>
            </Select>
          </Field>
          <Field label="Artış oranı (%)">
            <Input id="tf-rate" inputMode="decimal" className="num" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label="E-posta" className="sm:col-span-2">
            <Input id="tf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
      )}

      {error && <p className="rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">{error}</p>}
      {saved && <p className="rounded-md bg-positive-bg px-3 py-2 text-sm text-positive">{saved}</p>}
      <Button type="submit" variant={editing ? 'default' : 'brand'} size="lg">
        {editing ? 'Değişiklikleri kaydet' : 'Kiracıyı ekle'}
      </Button>
    </form>
  )
}
