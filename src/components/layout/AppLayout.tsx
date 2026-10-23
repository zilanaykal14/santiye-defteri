import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2, HardHat, Handshake, KeyRound, LayoutDashboard, ListOrdered, LogOut, Menu,
  NotebookPen, Plus, Settings, ShieldCheck, Users, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { SyncBadge } from '@/components/shared/SyncBadge'
import { InstallBanner } from '@/components/shared/InstallBanner'
import { pendingCount } from '@/lib/sync'
import { askConfirm } from '@/store/useUIStore'
import { TransactionDialog } from '@/features/islemler/TransactionDialog'
import { ChangePasswordDialog } from '@/features/kullanicilar/ChangePasswordDialog'
import { useUIStore } from '@/store/useUIStore'
import { useAuthStore, useCan } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import type { PageKey } from '@/types'

const NAV: { to: string; label: string; icon: LucideIcon; page: PageKey | 'kullanicilar' }[] = [
  { to: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard, page: 'dashboard' },
  { to: '/gunluk', label: 'Şantiye Günlüğü', icon: NotebookPen, page: 'gunluk' },
  { to: '/insaatlar', label: 'İnşaatlar', icon: HardHat, page: 'insaatlar' },
  { to: '/mahsuplasma', label: 'Mahsuplaşma', icon: Handshake, page: 'mahsuplasma' },
  { to: '/kiracilar', label: 'Kiracılar', icon: Users, page: 'kiracilar' },
  { to: '/mulkler-ve-kiralar', label: 'Mülkler & Kiralar', icon: Building2, page: 'mulkler' },
  { to: '/islemler', label: 'Tüm İşlemler', icon: ListOrdered, page: 'islemler' },
  { to: '/ayarlar', label: 'Ortaklar & Ayarlar', icon: Settings, page: 'ayarlar' },
  { to: '/kullanicilar', label: 'Kullanıcılar & Şifreler', icon: ShieldCheck, page: 'kullanicilar' },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan()
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => can.see(n.page)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-active font-semibold text-sidebar-foreground'
                : 'text-sidebar-muted hover:bg-sidebar-active/50 hover:text-sidebar-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn('size-[18px]', isActive && 'text-brand')} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <div className="grid size-9 place-items-center rounded-lg bg-brand text-brand-foreground">
        <HardHat className="size-5" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold text-sidebar-foreground">Şantiye Defteri</div>
        <div className="text-[11px] text-sidebar-muted">Portföy · İnşaat · Ortaklık</div>
      </div>
    </div>
  )
}

function UserBox({ onPassword }: { onPassword: () => void }) {
  const { user, isAdmin } = useCan()
  const logoutStore = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  // Çıkışta ana sayfaya dön: sonraki kullanıcı kendi ilk sayfasından başlasın
  const logoutNow = async () => {
    navigate('/', { replace: true })
    await logoutStore()
  }
  const logout = () => {
    const n = pendingCount()
    if (n > 0) askConfirm(`${n} kayıt henüz sunucuya gönderilmedi. Çıkış yaparsanız bu kayıtlar kaybolur. Yine de çıkılsın mı?`, () => void logoutNow())
    else void logoutNow()
  }
  if (!user) return null
  return (
    <div className="mx-3 rounded-lg border border-sidebar-line p-3">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-active text-xs font-bold text-sidebar-foreground">
          {user.name.slice(0, 1).toLocaleUpperCase('tr-TR')}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-sidebar-foreground">{user.name}</div>
          <div className="text-[11px] text-sidebar-muted">{isAdmin ? 'Yönetici' : 'Eleman'}</div>
        </div>
      </div>
      <SyncBadge className="mt-2" />
      <div className="mt-1 flex gap-1">
        <button onClick={onPassword} className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground cursor-pointer">
          <KeyRound className="size-3.5" /> Şifrem
        </button>
        <button onClick={logout} className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground cursor-pointer">
          <LogOut className="size-3.5" /> Çıkış
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [pwOpen, setPwOpen] = React.useState(false)
  const openTx = useUIStore((s) => s.openTxDialog)
  const can = useCan()
  const location = useLocation()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (location.pathname === '/yeni-islem' && can.add) openTx()
  }, [location.pathname, openTx, can.add])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,var(--sidebar)_256px,transparent_256px)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto bg-sidebar py-5 lg:flex print:hidden">
        <Brand />
        {can.add && (
          <div className="px-3">
            <Button variant="brand" className="w-full" onClick={() => openTx()}>
              <Plus /> Yeni İşlem
            </Button>
          </div>
        )}
        <div className="px-2">
          <NavItems />
        </div>
        <div className="mt-auto">
          <UserBox onPassword={() => setPwOpen(true)} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between bg-sidebar px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] lg:hidden print:hidden">
        <Brand />
        <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-active" onClick={() => setMobileOpen(true)} aria-label="Menü">
          <Menu />
        </Button>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col gap-5 overflow-y-auto bg-sidebar pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-[calc(env(safe-area-inset-top,0px)+16px)]">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-active" onClick={() => setMobileOpen(false)} aria-label="Kapat">
                <X />
              </Button>
            </div>
            <div className="px-2">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="mt-auto">
              <UserBox onPassword={() => { setMobileOpen(false); setPwOpen(true) }} />
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <InstallBanner />
        <Outlet />
      </main>

      {can.add && (
        <Button
          variant="brand"
          size="icon"
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+20px)] right-5 z-40 size-14 rounded-full shadow-lg lg:hidden print:hidden"
          onClick={() => openTx()}
          aria-label="Yeni işlem"
        >
          <Plus className="size-6!" />
        </Button>
      )}

      <ConfirmDialog />
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
      <TransactionDialog onClosed={() => location.pathname === '/yeni-islem' && navigate('/dashboard')} />
    </div>
  )
}
