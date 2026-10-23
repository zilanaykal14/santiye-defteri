import * as React from 'react'
import { Check, KeyRound, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, Field, Input, Segmented } from '@/components/ui'
import { PageHeader } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { useCurrentUser } from '@/store/useAuthStore'
import { hashPassword, newSalt, normalizeUsername, PAGES } from '@/lib/auth'
import { uid, cn } from '@/lib/utils'
import { MIN_PASSWORD } from './ChangePasswordDialog'
import { CLOUD } from '@/lib/backend'
import { notify } from '@/store/useToastStore'
import type { AppUser, PageKey, UserRole } from '@/types'

/** Yetki kutucuğu */
function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
        on ? 'border-primary/50 bg-accent' : 'hover:bg-muted',
      )}
    >
      <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card')}>
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={cn('block font-medium', on && 'text-accent-foreground')}>{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

export function UsersPage() {
  const { users, upsert, remove } = useAppStore()
  const me = useCurrentUser()
  const [adding, setAdding] = React.useState(false)
  const [resetFor, setResetFor] = React.useState<AppUser | null>(null)
  const activeAdmins = users.filter((u) => u.role === 'yonetici' && u.active)

  const save = (u: AppUser) => upsert('users', u)
  const isLastAdmin = (u: AppUser) => u.role === 'yonetici' && u.active && activeAdmins.length === 1

  return (
    <>
      <PageHeader
        title="Kullanıcılar & Şifreler"
        description="Kimin hangi sayfaya girebileceğini siz seçin. Yöneticiler her yere erişir."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> Kullanıcı ekle
          </Button>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {users.map((u) => {
          const self = u.id === me?.id
          const admin = u.role === 'yonetici'
          return (
            <Card key={u.id} className={cn(!u.active && 'opacity-70')}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('grid size-10 shrink-0 place-items-center rounded-full font-bold', admin ? 'bg-brand-soft text-brand-ink' : 'bg-accent text-accent-foreground')}>
                    {u.name.slice(0, 1).toLocaleUpperCase('tr-TR')}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate">
                      {u.name} {self && <span className="text-xs font-normal text-muted-foreground">(siz)</span>}
                    </CardTitle>
                    <CardDescription>Kullanıcı adı: <b className="text-foreground">{u.username}</b></CardDescription>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {admin ? <Badge variant="brand"><ShieldCheck className="size-3" /> Yönetici</Badge> : <Badge variant="info">Eleman</Badge>}
                  {!u.active && <Badge variant="negative">Kapalı</Badge>}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Segmented<UserRole>
                  value={u.role}
                  onChange={(role) => {
                    if (role === 'eleman' && (self || isLastAdmin(u))) return
                    save({ ...u, role })
                  }}
                  options={[
                    { value: 'yonetici', label: 'Yönetici', description: 'Her şeye erişir' },
                    { value: 'eleman', label: 'Eleman', description: 'Sadece seçtiğiniz sayfalar' },
                  ]}
                />
                {admin ? (
                  <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                    Yönetici tüm sayfalara girer, kayıt ekler, düzenler ve siler; kullanıcıları ve şifreleri yönetir.
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Girebileceği sayfalar</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PAGES.map((p) => (
                          <Toggle
                            key={p.key}
                            label={p.label}
                            hint={p.hint}
                            on={u.pages.includes(p.key)}
                            onChange={(on) => save({ ...u, pages: on ? [...u.pages, p.key] : u.pages.filter((k: PageKey) => k !== p.key) })}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">İşlem yetkisi</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Toggle label="Kayıt ekleyebilir" hint="Gider, günlük, kira tahsilatı, kiracı" on={u.canAdd} onChange={(v) => save({ ...u, canAdd: v })} />
                        <Toggle label="Düzenleyip silebilir" hint="Var olan kayıtları değiştirir" on={u.canEdit} onChange={(v) => save({ ...u, canEdit: v })} />
                      </div>
                    </div>
                  </>
                )}
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => setResetFor(u)}>
                    <KeyRound /> Şifre belirle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={self || isLastAdmin(u)}
                    onClick={() => save({ ...u, active: !u.active })}
                  >
                    {u.active ? 'Hesabı kapat' : 'Hesabı aç'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-negative"
                    disabled={self || isLastAdmin(u)}
                    onClick={() => askConfirm(`${u.name} kullanıcısı silinsin mi? Girdiği kayıtlar silinmez.`, () => remove('users', u.id))}
                  >
                    <Trash2 /> Sil
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AddUserDialog open={adding} onOpenChange={setAdding} />
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} />
    </>
  )
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { users, upsert } = useAppStore()
  const [name, setName] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [pw, setPw] = React.useState('')
  const [role, setRole] = React.useState<UserRole>('eleman')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName('')
      setUsername('')
      setPw('')
      setRole('eleman')
      setError('')
    }
  }, [open])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const un = normalizeUsername(username || name)
    if (!name.trim()) return setError('Ad zorunlu.')
    if (!un) return setError('Kullanıcı adı zorunlu.')
    if (users.some((u) => u.username === un)) return setError('Bu kullanıcı adı zaten var.')
    if (pw.length < MIN_PASSWORD) return setError(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
    if (CLOUD) {
      setBusy(true)
      const { cloudCreateUser } = await import('@/lib/cloudAuth')
      const res = await cloudCreateUser({ name: name.trim(), username: un, password: pw, role })
      setBusy(false)
      if (res.error) return setError(res.error)
      notify(`${name.trim()} eklendi. Kullanıcı adı: ${un}`, 'success')
      onOpenChange(false)
      return
    }
    const salt = newSalt()
    upsert('users', {
      id: uid('u-'),
      name: name.trim(),
      username: un,
      role,
      salt,
      passwordHash: await hashPassword(salt, pw),
      pages: role === 'eleman' ? ['gunluk'] : [],
      canAdd: true,
      canEdit: false,
      active: true,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Yeni kullanıcı" description="Eklendikten sonra hangi sayfalara girebileceğini kartından seçin." className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <Field label="Ad soyad / görevi">
            <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hasan Usta (Şantiye Şefi)" />
          </Field>
          <Field label="Kullanıcı adı" hint={`Girişte yazılacak: ${normalizeUsername(username || name) || '—'}`}>
            <Input id="nu-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="hasan" />
          </Field>
          <Field label="Şifre">
            <Input id="nu-pass" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={`En az ${MIN_PASSWORD} karakter`} />
          </Field>
          <Segmented<UserRole>
            value={role}
            onChange={setRole}
            options={[
              { value: 'eleman', label: 'Eleman', description: 'Sınırlı erişim' },
              { value: 'yonetici', label: 'Yönetici', description: 'Tam yetki' },
            ]}
          />
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Ekleniyor…' : 'Kullanıcıyı ekle'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  const upsert = useAppStore((s) => s.upsert)
  const [pw, setPw] = React.useState('')
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    setPw('')
    setError('')
  }, [user])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (pw.length < MIN_PASSWORD) return setError(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
    if (CLOUD) {
      const { cloudSetPassword } = await import('@/lib/cloudAuth')
      const err = await cloudSetPassword(user.id, pw)
      if (err) return setError(err)
      notify(`${user.name} için yeni şifre kaydedildi.`, 'success')
      onClose()
      return
    }
    const salt = newSalt()
    upsert('users', { ...user, salt, passwordHash: await hashPassword(salt, pw) })
    onClose()
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Şifre belirle" description={user ? `${user.name} için yeni şifre` : ''} className="sm:max-w-sm">
        <form onSubmit={save} className="grid gap-4">
          <Field label="Yeni şifre" hint="Kişiye bu şifreyi siz iletin.">
            <Input id="rp-pass" type="text" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit">Şifreyi kaydet</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
