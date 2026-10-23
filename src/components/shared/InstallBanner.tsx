import * as React from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { CLOUD } from '@/lib/backend'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Android/Chrome "yükle" olayını sayfa açılır açılmaz yakala
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
}

const KEY = 'santiye-yukle-gizle'
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
const isMobile = () => typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent)

/** Telefonda tarayıcıdan açıldıysa "ana ekrana ekle" yönlendirmesi gösterir */
export function InstallBanner() {
  const [, force] = React.useReducer((x: number) => x + 1, 0)
  const [hidden, setHidden] = React.useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  React.useEffect(() => {
    listeners.add(force)
    return () => {
      listeners.delete(force)
    }
  }, [])

  if (!CLOUD || hidden || isStandalone() || !isMobile()) return null

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* yoksay */
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-brand/40 bg-brand-soft p-4 text-sm">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-brand-ink" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Uygulama olarak yükleyin</p>
          {isIOS() ? (
            <p className="mt-1 text-muted-foreground">
              Safari'de alttaki <Share className="inline size-4 align-text-bottom" /> <b>Paylaş</b> düğmesine, sonra{' '}
              <SquarePlus className="inline size-4 align-text-bottom" /> <b>Ana Ekrana Ekle</b>'ye dokunun.
            </p>
          ) : deferred ? (
            <p className="mt-1 text-muted-foreground">Ana ekranınıza ikon olarak eklenir, uygulama gibi tam ekran açılır.</p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              Tarayıcı menüsünden (⋮) <b>Ana ekrana ekle</b> veya <b>Uygulamayı yükle</b>'yi seçin.
            </p>
          )}
          {deferred && !isIOS() && (
            <Button
              variant="brand"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await deferred?.prompt()
                const r = await deferred?.userChoice
                deferred = null
                if (r?.outcome === 'accepted') hide()
                else force()
              }}
            >
              <Download /> Yükle
            </Button>
          )}
        </div>
        <button onClick={hide} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Kapat">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
