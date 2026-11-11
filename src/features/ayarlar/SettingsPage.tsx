import * as React from 'react'
import { Download, RotateCcw, Star, Trash2, Upload, UserPlus } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui'
import { PageHeader, PartnerDot } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { IS_PREVIEW } from '@/lib/utils'
import { CLOUD } from '@/lib/backend'
import type { DataSnapshot } from '@/data/seed'
import { useCurrentUser } from '@/store/useAuthStore'
import { addDays, formatDate, todayISO } from '@/lib/dates'

/** Yedek indirildikçe bir hafta sonrasına kurulan hatırlatıcı */
export const BACKUP_REMINDER_ID = 'rm-yedek-haftalik'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function SettingsPage() {
  const store = useAppStore()
  const { partners, projects, transactions, addPartner, upsert, remove, resetDemo, clearAll, importSnapshot } = store
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [msg, setMsg] = React.useState('')

  const isUsed = (id: string) =>
    projects.some((p) => p.shares.some((s) => s.partnerId === id)) ||
    transactions.some((t) => (t.payer.kind === 'ortak' && t.payer.partnerId === id) || t.receiverPartnerId === id || t.ownerPartnerId === id)

  const me = useCurrentUser()
  const isAdmin = me?.role === 'yonetici'
  const backupReminder = store.reminders.find((r) => r.id === BACKUP_REMINDER_ID)

  /** Yedek dosyasını indirir; telefonda paylaşım menüsünü açar (Dosyalar'a, Drive'a, WhatsApp'a kaydet) */
  function exportJSON() {
    const s = useAppStore.getState()
    const snap: DataSnapshot = {
      partners: s.partners, projects: s.projects, properties: s.properties, units: s.units,
      tenants: s.tenants, leases: s.leases, rentPayments: s.rentPayments, transactions: s.transactions,
      users: s.users, siteLogs: s.siteLogs, reminders: s.reminders,
    }
    const today = todayISO()
    const name = `santiye-defteri-yedek-${today}.json`
    const json = JSON.stringify(snap, null, 2)

    // Bir sonraki yedek için hatırlatıcı (yalnızca yönetici: hatırlatıcılar ona özel)
    if (isAdmin) {
      upsert('reminders', {
        id: BACKUP_REMINDER_ID,
        text: 'Haftalık yedek al (Ortaklar & Ayarlar → Yedek indir)',
        dueDate: addDays(today, 7),
        done: false,
        createdAt: new Date().toISOString(),
      })
    }

    const file = typeof File !== 'undefined' ? new File([json], name, { type: 'application/json' }) : null
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
    if (mobile && file && nav.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: 'Şantiye Defteri yedeği' }).catch(() => undefined)
      setMsg('Açılan menüden "Dosyalara Kaydet", Google Drive veya kendinize WhatsApp seçin.')
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setMsg(`${name} indirildi. Dosyayı Google Drive'a veya e-postanıza kaydedin.`)
  }

  async function importJSON(file: File) {
    try {
      const data = JSON.parse(await file.text()) as DataSnapshot
      if (!Array.isArray(data.transactions) || !Array.isArray(data.partners)) throw new Error()
      importSnapshot(data)
      setMsg('Yedek başarıyla yüklendi.')
    } catch {
      setMsg('Dosya okunamadı — geçerli bir yedek değil.')
    }
  }

  return (
    <>
      <PageHeader title="Ortaklar & Ayarlar" description="Ortak kartları, yedekleme ve veri yönetimi" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ortaklar</CardTitle>
            <CardDescription>Yıldızlı kişi "ana kişi"dir (kardeşiniz); panodaki bakiyeler ona göre hesaplanır.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y rounded-md border">
              {partners.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <PartnerDot partner={p} className="font-medium" />
                    {p.phone && <div className="pl-3.5 text-xs text-muted-foreground">{p.phone}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isPrimary ? (
                      <Badge variant="positive"><Star className="size-3" /> Ana kişi</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => partners.forEach((x) => upsert('partners', { ...x, isPrimary: x.id === p.id }))}>
                        Ana kişi yap
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-negative"
                      disabled={isUsed(p.id)}
                      title={isUsed(p.id) ? 'Projelerde/işlemlerde kullanılıyor' : 'Sil'}
                      onClick={() => remove('partners', p.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                addPartner({ name: name.trim(), phone: phone || undefined, isPrimary: partners.length === 0, color: COLORS[partners.length % COLORS.length] })
                setName('')
                setPhone('')
              }}
            >
              <Field label="Ad soyad"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Telefon"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Button type="submit"><UserPlus /> Ekle</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Veri yönetimi</CardTitle>
            <CardDescription>
              {CLOUD
                ? 'Veriler çevrimiçi veritabanında saklanır ve tüm cihazlarda aynıdır. Ayda bir yedek indirmeniz önerilir.'
                : 'Veriler bu tarayıcının yerel deposunda tutulur. Düzenli yedek almanız önerilir.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {!IS_PREVIEW && <Button variant={CLOUD ? 'default' : 'outline'} onClick={exportJSON}><Download /> Yedek indir (JSON)</Button>}
              <Button
                variant="outline"
                onClick={() =>
                  CLOUD
                    ? askConfirm('Yedek yüklenirse herkesin gördüğü mevcut kayıtların yerine yedekteki kayıtlar geçer. Devam edilsin mi?', () => fileRef.current?.click())
                    : fileRef.current?.click()
                }
              >
                <Upload /> Yedek yükle
              </Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
            </div>
            {/* Demo yükleme ve toplu silme yalnızca yerel deneme modunda: gerçek veride çok tehlikeli */}
            {!CLOUD && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button variant="outline" onClick={() => askConfirm('Tüm veriler demo verisiyle değiştirilsin mi?', () => { resetDemo() })}>
                  <RotateCcw /> Demo verisini yükle
                </Button>
                <Button variant="destructive" onClick={() => askConfirm('TÜM veriler silinsin mi? Bu işlem geri alınamaz.', () => { clearAll() })}>
                  <Trash2 /> Tümünü temizle
                </Button>
              </div>
            )}
            {CLOUD && (
              <p className="text-xs text-muted-foreground">
                {backupReminder
                  ? `Son yedek: ${formatDate(backupReminder.createdAt.slice(0, 10))} · Sonraki: ${backupReminder.dueDate ? formatDate(backupReminder.dueDate) : '—'}`
                  : isAdmin
                    ? 'Henüz yedek alınmadı.'
                    : 'Tam yedek (kiralar ve hatırlatıcılar dahil) için yönetici hesabıyla alın.'}
              </p>
            )}
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
