import * as React from 'react'
import { Eye, EyeOff, HardHat, Lock, LogIn, ShieldCheck } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { SEED_USERS } from '@/data/seed'
import { CLOUD } from '@/lib/backend'
import { normalizeUsername } from '@/lib/auth'

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = React.useState(false)
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function Brand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-3 text-sidebar-foreground">
      <div className="grid size-11 place-items-center rounded-xl bg-brand text-brand-foreground shadow-lg">
        <HardHat className="size-6" />
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight">Şantiye Defteri</div>
        <div className="text-xs text-sidebar-muted">Portföy · İnşaat · Ortaklık</div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const [setupMode, setSetupMode] = React.useState<boolean | null>(CLOUD ? null : false)

  React.useEffect(() => {
    if (!CLOUD) return
    let alive = true
    import('@/lib/cloudAuth').then(({ needsSetup }) =>
      needsSetup().then((v) => {
        if (alive) setSetupMode(!!v)
      }),
    )
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="blueprint flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Brand />
        {setupMode === null ? (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-2xl">Bağlanılıyor…</div>
        ) : setupMode ? (
          <SetupForm />
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  )
}

function LoginForm() {
  const login = useAuthStore((s) => s.login)
  const users = useAppStore((s) => s.users)
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const demoActive = !CLOUD && SEED_USERS.some((s) => users.some((u) => u.id === s.id && u.passwordHash === s.passwordHash))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await login(username, password))
    setBusy(false)
  }

  return (
    <>
      <form onSubmit={submit} className="rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2">
          <Lock className="size-4 text-primary" />
          <h1 className="text-lg font-bold">Giriş yap</h1>
        </div>
        <div className="grid gap-4">
          <Field label="Kullanıcı adı">
            <Input id="login-user" autoFocus autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ör. hasan" />
          </Field>
          <Field label="Şifre">
            <PasswordInput id="login-pass" value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>
          {error && <p className="rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">{error}</p>}
          <Button type="submit" size="lg" disabled={busy || !username || !password}>
            <LogIn /> {busy ? 'Giriş yapılıyor…' : 'Giriş'}
          </Button>
        </div>
        {CLOUD && <p className="mt-4 text-center text-xs text-muted-foreground">Şifrenizi unuttuysanız yöneticinizden yeni şifre isteyin.</p>}
      </form>

      {demoActive && (
        <div className="mt-4 rounded-xl border border-sidebar-line bg-sidebar-active/60 p-4 text-xs text-sidebar-muted">
          <p className="mb-2 font-semibold text-sidebar-foreground">Deneme hesapları</p>
          <ul className="grid gap-1">
            <li><b className="text-sidebar-foreground">yonetici</b> / 1234 — her yere girer</li>
            <li><b className="text-sidebar-foreground">santiye</b> / 1111 — sadece günlük ve inşaatlar</li>
            <li><b className="text-sidebar-foreground">muhasebe</b> / 2222 — kiralar ve işlemler</li>
          </ul>
          <p className="mt-2">Bu bir önizlemedir; veriler yalnızca bu tarayıcıda durur.</p>
        </div>
      )}
    </>
  )
}

/** Bulut modunda ilk açılış: yönetici hesabını oluşturma */
function SetupForm() {
  const setup = useAuthStore((s) => s.setup)
  const [name, setName] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [pw, setPw] = React.useState('')
  const [pw2, setPw2] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Adınızı yazın.')
    if (!normalizeUsername(username)) return setError('Bir kullanıcı adı seçin.')
    if (pw.length < 6) return setError('Şifre en az 6 karakter olmalı.')
    if (pw !== pw2) return setError('Şifreler aynı değil.')
    setBusy(true)
    setError(await setup(name.trim(), username, pw))
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-6 shadow-2xl">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="size-4 text-brand" />
        <h1 className="text-lg font-bold">İlk kurulum</h1>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">Yönetici hesabınızı oluşturun. Diğer kişileri sonra siz eklersiniz.</p>
      <div className="grid gap-4">
        <Field label="Adınız">
          <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ahmet Yılmaz" />
        </Field>
        <Field label="Kullanıcı adı" hint={username ? `Girişte yazacağınız: ${normalizeUsername(username)}` : undefined}>
          <Input id="setup-user" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmet" />
        </Field>
        <Field label="Şifre (en az 6 karakter)">
          <PasswordInput id="setup-pass" value={pw} onChange={setPw} autoComplete="new-password" />
        </Field>
        <Field label="Şifre (tekrar)">
          <PasswordInput id="setup-pass2" value={pw2} onChange={setPw2} autoComplete="new-password" />
        </Field>
        {error && <p className="rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">{error}</p>}
        <Button type="submit" variant="brand" size="lg" disabled={busy}>
          {busy ? 'Oluşturuluyor…' : 'Yönetici hesabını oluştur'}
        </Button>
      </div>
    </form>
  )
}
