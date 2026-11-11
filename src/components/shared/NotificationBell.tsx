import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CalendarClock, CheckCircle2, NotebookPen, Wallet } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { useCan } from '@/store/useAuthStore'
import { useToday } from '@/hooks/useFinance'
import { buildNotices, urgentCount, type Notice } from '@/lib/notifications'
import { cn } from '@/lib/utils'

export function useNotices(): Notice[] {
  const { leases, rentPayments, tenants, units, reminders } = useAppStore()
  const can = useCan()
  const { today } = useToday()
  return React.useMemo(
    () =>
      buildNotices({ today, leases, rentPayments, tenants, units, reminders, canSeeRentals: can.rentals, isAdmin: can.isAdmin }),
    [today, leases, rentPayments, tenants, units, reminders, can.rentals, can.isAdmin],
  )
}

const ICON = { kira: Wallet, sozlesme: CalendarClock, hatirlatici: NotebookPen } as const
const TONE = {
  negative: 'bg-negative-bg text-negative',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
} as const

/** Zil düğmesi + bildirim listesi. Telefonda ana ekran ikonunda da sayı gösterir. */
export function NotificationBell({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const notices = useNotices()
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()
  const urgent = urgentCount(notices)

  // Ana ekran ikonundaki kırmızı sayı (destekleyen telefonlarda)
  React.useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    try {
      if (urgent > 0) void nav.setAppBadge?.(urgent)?.catch(() => undefined)
      else void nav.clearAppBadge?.()?.catch(() => undefined)
    } catch {
      /* desteklenmiyor */
    }
  }, [urgent])

  const Icon = urgent > 0 ? BellRing : Bell
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Bildirimler${notices.length ? ` (${notices.length})` : ''}`}
        className={cn(
          'relative grid size-10 place-items-center rounded-lg transition-colors cursor-pointer',
          tone === 'dark' ? 'text-sidebar-foreground hover:bg-sidebar-active' : 'hover:bg-muted',
          className,
        )}
      >
        <Icon className="size-5" />
        {notices.length > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold',
              urgent > 0 ? 'bg-negative text-white' : 'bg-info text-white',
            )}
          >
            {notices.length > 99 ? '99+' : notices.length}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Bildirimler" description={notices.length ? `${notices.length} konu ilgi bekliyor` : undefined} className="sm:max-w-lg">
          {notices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="size-8 text-positive" />
              Geciken kira veya bekleyen hatırlatıcı yok.
            </div>
          ) : (
            <ul className="grid gap-2">
              {notices.map((n) => {
                const I = ICON[n.kind]
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        setOpen(false)
                        navigate(n.to)
                      }}
                      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted cursor-pointer"
                    >
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', TONE[n.tone])}>
                        <I className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{n.title}</span>
                        <span className="block text-xs text-muted-foreground">{n.detail}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
