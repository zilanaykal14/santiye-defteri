import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Dialog, DialogContent, Field, Input, Select } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { COST_CATEGORIES, CATEGORY_LABEL, PROJECT_STATUS_LABEL } from '@/lib/labels'
import { parseTL } from '@/lib/money'
import { todayISO } from '@/lib/dates'
import type { CostCategory, Project, ProjectStatus } from '@/types'

interface ShareRow {
  partnerId: string
  pct: string
}

/** Proje oluştur / düzenle — ortaklar ve hisse oranları burada tanımlanır */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project?: Project
}) {
  const { partners, addProject, upsert } = useAppStore()
  const [name, setName] = React.useState(project?.name ?? '')
  const [location, setLocation] = React.useState(project?.location ?? '')
  const [status, setStatus] = React.useState<ProjectStatus>(project?.status ?? 'devam')
  const [startDate, setStartDate] = React.useState(project?.startDate ?? todayISO())
  const [plannedEndDate, setPlannedEndDate] = React.useState(project?.plannedEndDate ?? '')
  const [progress, setProgress] = React.useState(String(project?.progress ?? 0))
  const [unitCount, setUnitCount] = React.useState(String(project?.unitCount ?? ''))
  const [shares, setShares] = React.useState<ShareRow[]>(
    project?.shares.map((s) => ({ partnerId: s.partnerId, pct: String(s.shareBps / 100) })) ?? [
      { partnerId: partners.find((p) => p.isPrimary)?.id ?? '', pct: '100' },
    ],
  )
  const [budget, setBudget] = React.useState<Record<CostCategory, string>>(
    Object.fromEntries(COST_CATEGORIES.map((c) => [c, project ? String(project.budget[c] / 100) : ''])) as Record<CostCategory, string>,
  )
  const [error, setError] = React.useState('')

  const totalPct = shares.reduce((a, s) => a + (Number(s.pct.replace(',', '.')) || 0), 0)

  function save() {
    if (!name.trim()) return setError('Proje adı zorunlu.')
    if (shares.some((s) => !s.partnerId)) return setError('Her satırda ortak seçin.')
    if (new Set(shares.map((s) => s.partnerId)).size !== shares.length) return setError('Aynı ortak iki kez eklenmiş.')
    if (Math.abs(totalPct - 100) > 0.001) return setError(`Hisse toplamı %${totalPct} — tam %100 olmalı.`)
    const data: Omit<Project, 'id'> = {
      name: name.trim(),
      location: location.trim(),
      status,
      startDate,
      plannedEndDate: plannedEndDate || undefined,
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      unitCount: unitCount ? Number(unitCount) : undefined,
      shares: shares.map((s) => ({ partnerId: s.partnerId, shareBps: Math.round(Number(s.pct.replace(',', '.')) * 100) })),
      budget: Object.fromEntries(COST_CATEGORIES.map((c) => [c, parseTL(budget[c]) ?? 0])) as Record<CostCategory, number>,
      notes: project?.notes,
    }
    if (project) upsert('projects', { ...data, id: project.id })
    else addProject(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={project ? 'Projeyi düzenle' : 'Yeni inşaat projesi'} description="Ortaklar, hisse oranları ve kategori bütçeleri">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Proje adı">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bağlar 12 Daire Projesi" />
            </Field>
            <Field label="Konum">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
            <Field label="Durum">
              <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="İlerleme %">
                <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} />
              </Field>
              <Field label="Bağımsız bölüm">
                <Input type="number" min={0} value={unitCount} onChange={(e) => setUnitCount(e.target.value)} />
              </Field>
            </div>
            <Field label="Başlangıç">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Planlanan bitiş">
              <Input type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
            </Field>
          </div>

          <fieldset className="rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Ortaklar ve hisseler</legend>
            <div className="grid gap-2">
              {shares.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Select
                    value={s.partnerId}
                    onChange={(e) => setShares(shares.map((x, j) => (j === i ? { ...x, partnerId: e.target.value } : x)))}
                  >
                    <option value="">Ortak seçin…</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <div className="relative w-28 shrink-0">
                    <Input
                      inputMode="decimal"
                      value={s.pct}
                      onChange={(e) => setShares(shares.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))}
                      className="num pr-7 text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShares(shares.filter((_, j) => j !== i))} disabled={shares.length === 1} aria-label="Kaldır">
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setShares([...shares, { partnerId: '', pct: '' }])}>
                <Plus /> Ortak ekle
              </Button>
              <span className={`num text-sm ${Math.abs(totalPct - 100) < 0.001 ? 'text-positive' : 'text-negative'}`}>Toplam %{totalPct}</span>
            </div>
          </fieldset>

          <fieldset className="rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Öngörülen bütçe (₺)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {COST_CATEGORIES.map((c) => (
                <Field key={c} label={CATEGORY_LABEL[c]}>
                  <Input inputMode="decimal" className="num" value={budget[c]} onChange={(e) => setBudget({ ...budget, [c]: e.target.value })} placeholder="0" />
                </Field>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button onClick={save}>Kaydet</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
