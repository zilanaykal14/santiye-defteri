import * as React from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, MapPin, Plus, Wallet } from 'lucide-react'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { EmptyState, Money, PageHeader, PartnerDot } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { useSettlement } from '@/hooks/useFinance'
import { useCan } from '@/store/useAuthStore'
import { projectTotals } from '@/lib/metrics'
import { PROJECT_STATUS_LABEL } from '@/lib/labels'
import { formatDate } from '@/lib/dates'
import { ProjectFormDialog } from './ProjectFormDialog'
import { HardHat } from 'lucide-react'
import type { ProjectStatus } from '@/types'

const STATUS_VARIANT: Record<ProjectStatus, 'info' | 'warning' | 'positive' | 'default'> = {
  devam: 'info',
  planlama: 'default',
  beklemede: 'warning',
  tamamlandi: 'positive',
}

export function ProjectsPage() {
  const { projects, transactions, partners } = useAppStore()
  const settlement = useSettlement()
  const [open, setOpen] = React.useState(false)
  const can = useCan()
  const pMap = new Map(partners.map((p) => [p.id, p]))

  const sorted = [...projects].sort((a, b) => Number(a.status === 'tamamlandi') - Number(b.status === 'tamamlandi'))

  return (
    <>
      <PageHeader
        title="İnşaatlar"
        description="Şantiye kartları, bütçe vs. gerçekleşen maliyet ve hisse dağılımı"
        actions={
          can.edit && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> Yeni proje
            </Button>
          )
        }
      />
      {projects.length === 0 && <EmptyState icon={HardHat} title="Henüz proje yok">İlk projenizi ekleyip ortakları ve hisseleri tanımlayın.</EmptyState>}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sorted.map((p) => {
          const t = projectTotals(p, transactions)
          const ratio = t.ratio * 100
          const kasa = settlement.perProject.find((x) => x.projectId === p.id)?.kasaBalance ?? 0
          return (
            <Link key={p.id} to={`/insaatlar/${p.id}`} className="group">
              <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold tracking-tight group-hover:text-primary">{p.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {p.location || '—'}
                      {p.unitCount ? ` · ${p.unitCount} bağımsız bölüm` : ''}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                </div>

                <div className="mt-4 grid gap-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Fiziksel ilerleme</span>
                    <span className="num">%{p.progress}</span>
                  </div>
                  <Progress value={p.progress} />
                </div>

                <div className="mt-3 grid gap-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Bütçe kullanımı</span>
                    <span className="num">%{Math.round(ratio)}</span>
                  </div>
                  <Progress value={ratio} tone={ratio > 100 ? 'negative' : ratio > p.progress + 15 ? 'warning' : 'positive'} />
                  <div className="flex justify-between text-sm">
                    <Money value={t.actual} className="font-medium" />
                    <span className="text-muted-foreground">
                      / <Money value={t.budget} />
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-xs">
                  {p.shares.map((s) => (
                    <span key={s.partnerId} className="inline-flex items-center gap-1">
                      <PartnerDot partner={pMap.get(s.partnerId)} />
                      <span className="num text-muted-foreground">%{s.shareBps / 100}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="size-3" /> {formatDate(p.startDate)}
                    {p.plannedEndDate ? ` → ${formatDate(p.plannedEndDate)}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="size-3" /> Kasa <Money value={kasa} className={kasa < 0 ? 'text-negative' : ''} />
                  </span>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
      <ProjectFormDialog key={String(open)} open={open} onOpenChange={setOpen} />
    </>
  )
}
