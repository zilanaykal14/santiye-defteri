import { CloudOff, CloudUpload, Cloud, CircleAlert, RefreshCw } from 'lucide-react'
import { CLOUD } from '@/lib/backend'
import { useSyncStatus, flush, reloadAll } from '@/lib/sync'
import { cn } from '@/lib/utils'

/** Kayıtların sunucuya gidip gitmediğini gösterir (yalnızca bulut modunda) */
export function SyncBadge({ className }: { className?: string }) {
  const { state, pending } = useSyncStatus()
  if (!CLOUD) return null
  const view = {
    hazir: { icon: Cloud, text: 'Tüm kayıtlar kaydedildi', cls: 'text-sidebar-muted' },
    yukleniyor: { icon: RefreshCw, text: 'Veriler yükleniyor…', cls: 'text-sidebar-muted' },
    gonderiliyor: { icon: CloudUpload, text: `Gönderiliyor (${pending})`, cls: 'text-sidebar-foreground' },
    cevrimdisi: { icon: CloudOff, text: `İnternet yok · ${pending} kayıt bekliyor`, cls: 'text-brand' },
    hata: { icon: CircleAlert, text: 'Bağlantı sorunu · yenile', cls: 'text-brand' },
  }[state]
  const Icon = view.icon
  return (
    <button
      onClick={() => void flush().then(() => reloadAll())}
      title="Şimdi eşitle"
      className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-sidebar-active cursor-pointer', view.cls, className)}
    >
      <Icon className={cn('size-3.5 shrink-0', state === 'yukleniyor' && 'animate-spin')} />
      <span className="truncate">{view.text}</span>
    </button>
  )
}
