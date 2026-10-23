import * as React from 'react'
import { Download, RotateCcw, Star, Trash2, Upload, UserPlus } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui'
import { PageHeader, PartnerDot } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { IS_PREVIEW } from '@/lib/utils'
import type { DataSnapshot } from '@/data/seed'

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

  function exportJSON() {
    const s = useAppStore.getState()
    const snap: DataSnapshot = {
      partners: s.partners, projects: s.projects, properties: s.properties, units: s.units,
      tenants: s.tenants, leases: s.leases, rentPayments: s.rentPayments, transactions: s.transactions,
      users: s.users, siteLogs: s.siteLogs,
    }
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `santiye-defteri-yedek-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
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
            <CardDescription>Veriler bu tarayıcının yerel deposunda tutulur. Düzenli yedek almanız önerilir.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {!IS_PREVIEW && <Button variant="outline" onClick={exportJSON}><Download /> Yedek indir (JSON)</Button>}
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Yedek yükle</Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => askConfirm('Tüm veriler demo verisiyle değiştirilsin mi?', () => { resetDemo() })}>
                <RotateCcw /> Demo verisini yükle
              </Button>
              <Button variant="destructive" onClick={() => askConfirm('TÜM veriler silinsin mi? Bu işlem geri alınamaz.', () => { clearAll() })}>
                <Trash2 /> Tümünü temizle
              </Button>
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
