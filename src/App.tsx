import { lazy, Suspense, useEffect } from 'react'
import { HardHat } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { Toaster } from '@/components/shared/Toaster'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { Guard } from '@/features/auth/Guard'
import { useCan } from '@/store/useAuthStore'
import { firstAllowedPath } from '@/lib/auth'
import type { PageKey } from '@/types'

// Sayfa bazlı kod bölme (code splitting)
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SiteLogPage = lazy(() => import('@/features/gunluk/SiteLogPage').then((m) => ({ default: m.SiteLogPage })))
const ProjectsPage = lazy(() => import('@/features/insaatlar/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ProjectDetailPage = lazy(() => import('@/features/insaatlar/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })))
const SettlementPage = lazy(() => import('@/features/mahsuplasma/SettlementPage').then((m) => ({ default: m.SettlementPage })))
const TenantsPage = lazy(() => import('@/features/kiracilar/TenantsPage').then((m) => ({ default: m.TenantsPage })))
const PropertiesPage = lazy(() => import('@/features/mulkler/PropertiesPage').then((m) => ({ default: m.PropertiesPage })))
const TransactionsPage = lazy(() => import('@/features/islemler/TransactionsPage').then((m) => ({ default: m.TransactionsPage })))
const SettingsPage = lazy(() => import('@/features/ayarlar/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const UsersPage = lazy(() => import('@/features/kullanicilar/UsersPage').then((m) => ({ default: m.UsersPage })))

/** Statik barındırma (tek dosya önizleme) için VITE_HASH_ROUTER=1 ile hash router kullanılır */
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter

const page = (key: PageKey | 'kullanicilar', el: React.ReactNode) => (
  <Guard page={key}>
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Yükleniyor…</div>}>{el}</Suspense>
  </Guard>
)

function Home() {
  const { user } = useCan()
  return <Navigate to={firstAllowedPath(user)} replace />
}

function Splash() {
  return (
    <div className="blueprint flex min-h-dvh flex-col items-center justify-center gap-4 text-sidebar-foreground">
      <div className="grid size-14 animate-pulse place-items-center rounded-2xl bg-brand text-brand-foreground">
        <HardHat className="size-7" />
      </div>
      <p className="text-sm text-sidebar-muted">Şantiye Defteri açılıyor…</p>
    </div>
  )
}

export default function App() {
  const { user } = useCan()
  const ready = useAuthStore((s) => s.ready)
  const init = useAuthStore((s) => s.init)
  useEffect(() => {
    void init()
  }, [init])

  if (!ready) return <Splash />
  if (!user || !user.active)
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    )
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={page('dashboard', <DashboardPage />)} />
          <Route path="yeni-islem" element={<Home />} />
          <Route path="gunluk" element={page('gunluk', <SiteLogPage />)} />
          <Route path="insaatlar" element={page('insaatlar', <ProjectsPage />)} />
          <Route path="insaatlar/:id" element={page('insaatlar', <ProjectDetailPage />)} />
          <Route path="mahsuplasma" element={page('mahsuplasma', <SettlementPage />)} />
          <Route path="kiracilar" element={page('kiracilar', <TenantsPage />)} />
          <Route path="mulkler-ve-kiralar" element={page('mulkler', <PropertiesPage />)} />
          <Route path="islemler" element={page('islemler', <TransactionsPage />)} />
          <Route path="ayarlar" element={page('ayarlar', <SettingsPage />)} />
          <Route path="kullanicilar" element={page('kullanicilar', <UsersPage />)} />
          <Route path="yetki-yok" element={<Guard page="kullanicilar"><span /></Guard>} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
      <Toaster />
    </Router>
  )
}
