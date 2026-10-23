import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { useToastStore } from '@/store/useToastStore'
import { cn } from '@/lib/utils'

/** Ekranın altında beliren kısa bildirimler */
export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  if (!toasts.length) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = t.tone === 'error' ? CircleAlert : t.tone === 'success' ? CheckCircle2 : Info
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl',
              t.tone === 'error' ? 'border-negative/30 bg-negative-bg text-negative' : t.tone === 'success' ? 'border-positive/30 bg-positive-bg text-positive' : 'bg-card text-foreground',
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100 cursor-pointer" aria-label="Kapat">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
