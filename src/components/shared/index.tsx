import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge, Card, type BadgeVariant } from '@/components/ui'
import { formatSigned, formatTL } from '@/lib/money'
import { RENT_STATUS_LABEL } from '@/lib/rent'
import { cn } from '@/lib/utils'
import type { Kurus, Partner, RentStatus } from '@/types'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Tutar gösterimi. `signed` ise +/− ve renk */
export function Money({ value, signed, className }: { value: Kurus; signed?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'num whitespace-nowrap',
        signed && value > 0 && 'text-positive',
        signed && value < 0 && 'text-negative',
        className,
      )}
    >
      {signed ? formatSigned(value) : formatTL(value)}
    </span>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: LucideIcon
  tone?: 'default' | 'positive' | 'negative' | 'warning' | 'brand'
}) {
  const toneCls = {
    default: 'bg-accent text-accent-foreground',
    positive: 'bg-positive-bg text-positive',
    negative: 'bg-negative-bg text-negative',
    warning: 'bg-warning-bg text-warning',
    brand: 'bg-brand-soft text-brand-ink',
  }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <div className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
        </div>
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-lg', toneCls)}>
          <Icon className="size-[18px]" />
        </div>
      </div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  )
}

const RENT_VARIANT: Record<RentStatus, BadgeVariant> = {
  odendi: 'positive',
  kismi: 'warning',
  gecikmede: 'negative',
  yaklasan: 'info',
  bekliyor: 'default',
}
export function RentStatusBadge({ status, daysLate }: { status: RentStatus; daysLate?: number }) {
  return (
    <Badge variant={RENT_VARIANT[status]}>
      {RENT_STATUS_LABEL[status]}
      {daysLate ? ` · ${daysLate} gün` : ''}
    </Badge>
  )
}

export function PartnerDot({ partner, className }: { partner?: Partner; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: partner?.color ?? 'var(--muted-foreground)' }} />
      <span className="truncate">{partner?.name ?? 'Bilinmeyen'}</span>
    </span>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}
