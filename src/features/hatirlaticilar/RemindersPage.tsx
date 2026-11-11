import * as React from 'react'
import { AlarmClock, Check, ChevronDown, Lock, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input } from '@/components/ui'
import { EmptyState, PageHeader } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { useToday } from '@/hooks/useFinance'
import { addDays, dayDiff, formatDate } from '@/lib/dates'
import { cn, uid } from '@/lib/utils'
import type { Reminder } from '@/types'

type Quick = 'bugun' | 'yarin' | 'hafta' | 'tarihsiz' | 'ozel'

function dueLabel(r: Reminder, today: string) {
  if (!r.dueDate) return null
  const d = dayDiff(today, r.dueDate)
  if (d < 0) return { text: `${-d} gün geçti`, variant: 'negative' as const }
  if (d === 0) return { text: 'Bugün', variant: 'warning' as const }
  if (d === 1) return { text: 'Yarın', variant: 'info' as const }
  return { text: formatDate(r.dueDate), variant: 'default' as const }
}

/** Yalnızca yöneticinin gördüğü kişisel hatırlatıcılar (sunucuda da kilitli) */
export function RemindersPage() {
  const { reminders, upsert, remove } = useAppStore()
  const { today } = useToday()
  const [text, setText] = React.useState('')
  const [quick, setQuick] = React.useState<Quick>('tarihsiz')
  const [custom, setCustom] = React.useState(today)
  const [showDone, setShowDone] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const dueFor = (q: Quick): string | undefined =>
    q === 'bugun' ? today : q === 'yarin' ? addDays(today, 1) : q === 'hafta' ? addDays(today, 7) : q === 'ozel' ? custom : undefined

  function add(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return inputRef.current?.focus()
    upsert('reminders', { id: uid('rm-'), text: t, dueDate: dueFor(quick), done: false, createdAt: new Date().toISOString() })
    setText('')
    inputRef.current?.focus()
  }

  const toggle = (r: Reminder) =>
    upsert('reminders', r.done ? { ...r, done: false, doneAt: undefined } : { ...r, done: true, doneAt: new Date().toISOString() })

  const open = reminders.filter((r) => !r.done)
  const byDate = (a: Reminder, b: Reminder) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.createdAt.localeCompare(b.createdAt)
  const groups: { key: string; title: string; items: Reminder[]; tone?: string }[] = [
    { key: 'gecmis', title: 'Günü geçenler', items: open.filter((r) => r.dueDate && r.dueDate < today).sort(byDate), tone: 'text-negative' },
    { key: 'bugun', title: 'Bugün', items: open.filter((r) => r.dueDate === today).sort(byDate), tone: 'text-warning' },
    { key: 'yaklasan', title: 'Yaklaşan', items: open.filter((r) => r.dueDate && r.dueDate > today).sort(byDate) },
    { key: 'tarihsiz', title: 'Tarihsiz', items: open.filter((r) => !r.dueDate).sort(byDate) },
  ].filter((g) => g.items.length)
  const done = reminders.filter((r) => r.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 30)

  const QUICK: { k: Quick; label: string }[] = [
    { k: 'tarihsiz', label: 'Tarihsiz' },
    { k: 'bugun', label: 'Bugün' },
    { k: 'yarin', label: 'Yarın' },
    { k: 'hafta', label: '1 hafta sonra' },
    { k: 'ozel', label: 'Tarih seç' },
  ]

  const Row = ({ r }: { r: Reminder }) => {
    const due = dueLabel(r, today)
    return (
      <li className="group flex items-start gap-3 py-3">
        <button
          onClick={() => toggle(r)}
          aria-label={r.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
          className={cn(
            'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors cursor-pointer',
            r.done ? 'border-positive bg-positive text-white' : 'border-input hover:border-primary',
          )}
        >
          {r.done && <Check className="size-3.5" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('break-words text-[15px] leading-snug', r.done && 'text-muted-foreground line-through')}>{r.text}</p>
          {due && !r.done && (
            <Badge variant={due.variant} className="mt-1.5">
              {due.text}
            </Badge>
          )}
        </div>
        <button
          onClick={() => remove('reminders', r.id)}
          aria-label="Sil"
          className="rounded p-1 text-muted-foreground hover:text-negative cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </li>
    )
  }

  return (
    <>
      <PageHeader title="Hatırlatıcılar" description="Kendine notlar. Tarihi gelenler bildirim zilinde görünür." />
      <p className="-mt-3 mb-5 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Lock className="size-3" /> Bu sayfayı yalnızca yöneticiler görür
      </p>

      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={add} className="grid gap-3">
              <div className="flex gap-2">
                <Input
                  id="rm-text"
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ne hatırlatılsın? (ör. Belediyeye iskele izni)"
                  className="h-11 text-[15px]"
                />
                <Button type="submit" variant="brand" className="h-11 shrink-0">
                  <Plus /> Ekle
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q.k}
                    type="button"
                    onClick={() => setQuick(q.k)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm cursor-pointer',
                      quick === q.k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                    )}
                  >
                    {q.label}
                  </button>
                ))}
                {quick === 'ozel' && <Input id="rm-date" type="date" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-8 w-auto" />}
              </div>
            </form>
          </CardContent>
        </Card>

        {groups.length === 0 ? (
          <EmptyState icon={AlarmClock} title="Bekleyen hatırlatıcı yok">
            Yukarıya yazıp Ekle'ye basın.
          </EmptyState>
        ) : (
          groups.map((g) => (
            <section key={g.key}>
              <h2 className={cn('mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground', g.tone)}>
                {g.title} · {g.items.length}
              </h2>
              <Card>
                <ul className="divide-y px-4">
                  {g.items.map((r) => (
                    <Row key={r.id} r={r} />
                  ))}
                </ul>
              </Card>
            </section>
          ))
        )}

        {done.length > 0 && (
          <section>
            <button
              onClick={() => setShowDone(!showDone)}
              className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer"
              aria-expanded={showDone}
            >
              <ChevronDown className={cn('size-4 transition-transform', showDone && 'rotate-180')} />
              Tamamlananlar · {done.length}
            </button>
            {showDone && (
              <Card>
                <ul className="divide-y px-4">
                  {done.map((r) => (
                    <Row key={r.id} r={r} />
                  ))}
                </ul>
              </Card>
            )}
          </section>
        )}
      </div>
    </>
  )
}
