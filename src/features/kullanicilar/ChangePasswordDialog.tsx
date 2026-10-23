import * as React from 'react'
import { Button, Dialog, DialogContent, Field, Input } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { useCurrentUser } from '@/store/useAuthStore'
import { hashPassword, newSalt, verifyPassword } from '@/lib/auth'
import { CLOUD } from '@/lib/backend'

/** Supabase en az 6 karakter ister */
export const MIN_PASSWORD = CLOUD ? 6 : 4

/** Kullanıcının kendi şifresini değiştirmesi */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useCurrentUser()
  const upsert = useAppStore((s) => s.upsert)
  const [oldPw, setOldPw] = React.useState('')
  const [pw, setPw] = React.useState('')
  const [pw2, setPw2] = React.useState('')
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null)

  React.useEffect(() => {
    if (open) {
      setOldPw('')
      setPw('')
      setPw2('')
      setMsg(null)
    }
  }, [open])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (pw.length < MIN_PASSWORD) return setMsg({ ok: false, text: `Yeni şifre en az ${MIN_PASSWORD} karakter olmalı.` })
    if (pw !== pw2) return setMsg({ ok: false, text: 'Yeni şifreler aynı değil.' })
    if (CLOUD) {
      const { cloudChangeOwnPassword } = await import('@/lib/cloudAuth')
      const err = await cloudChangeOwnPassword(user.username, oldPw, pw)
      if (err) return setMsg({ ok: false, text: err })
      setMsg({ ok: true, text: 'Şifreniz değiştirildi.' })
      setTimeout(() => onOpenChange(false), 900)
      return
    }
    if (!(await verifyPassword(user, oldPw))) return setMsg({ ok: false, text: 'Mevcut şifre yanlış.' })
    const salt = newSalt()
    upsert('users', { ...user, salt, passwordHash: await hashPassword(salt, pw) })
    setMsg({ ok: true, text: 'Şifreniz değiştirildi.' })
    setTimeout(() => onOpenChange(false), 900)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Şifremi değiştir" description={user?.name} className="sm:max-w-sm">
        <form onSubmit={save} className="grid gap-4">
          <Field label="Mevcut şifre">
            <Input id="pw-old" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
          </Field>
          <Field label="Yeni şifre">
            <Input id="pw-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Yeni şifre (tekrar)">
            <Input id="pw-new2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          {msg && <p className={msg.ok ? 'text-sm text-positive' : 'text-sm text-negative'}>{msg.text}</p>}
          <Button type="submit">Kaydet</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
