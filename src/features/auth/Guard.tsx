import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui'
import { useCan } from '@/store/useAuthStore'
import { firstAllowedPath } from '@/lib/auth'
import type { PageKey } from '@/types'

/** Sayfa yetkisi yoksa erişimi engeller */
export function Guard({ page, children }: { page: PageKey | 'kullanicilar'; children: React.ReactNode }) {
  const can = useCan()
  if (can.see(page)) return <>{children}</>
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-negative-bg text-negative">
        <ShieldX className="size-7" />
      </div>
      <h1 className="text-xl font-bold">Bu sayfaya erişim yetkiniz yok</h1>
      <p className="text-sm text-muted-foreground">Erişim için yöneticinizden bu sayfayı hesabınıza açmasını isteyin.</p>
      <Button asChild variant="outline">
        <Link to={firstAllowedPath(can.user)}>Ana sayfama dön</Link>
      </Button>
    </div>
  )
}
