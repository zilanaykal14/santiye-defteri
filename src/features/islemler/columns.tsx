import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { Money } from '@/components/shared'
import { CATEGORY_LABEL, KIND_LABEL } from '@/lib/labels'
import { formatDate } from '@/lib/dates'
import type { Partner, Project, Property, Transaction } from '@/types'
import { currentCanEdit } from '@/store/useAuthStore'

interface Ctx {
  partners: Map<string, Partner>
  projects: Map<string, Project>
  properties: Map<string, Property>
  onDelete?: (t: Transaction) => void
  onEdit?: (t: Transaction) => void
  hideContext?: boolean
}

export function payerLabel(t: Transaction, partners: Map<string, Partner>) {
  return t.payer.kind === 'kasa' ? 'Ortak kasa' : (partners.get(t.payer.partnerId)?.name ?? '—')
}

/** İşlem tablosu kolonları — /islemler ve proje detayında ortak kullanılır */
export function transactionColumns({ partners, projects, properties, onDelete: del, onEdit: ed, hideContext }: Ctx): ColumnDef<Transaction, unknown>[] {
  // Düzenle/sil yalnızca yetkili kullanıcıya
  const allowed = currentCanEdit()
  const onDelete = allowed ? del : undefined
  const onEdit = allowed ? ed : undefined
  const cols: ColumnDef<Transaction, unknown>[] = [
    {
      accessorKey: 'date',
      header: 'Tarih',
      cell: ({ row }) => <span className="num text-xs">{formatDate(row.original.date)}</span>,
    },
    {
      id: 'desc',
      accessorFn: (t) => `${t.description} ${t.docNo ?? ''} ${t.vendor ?? ''}`,
      header: 'Açıklama',
      cell: ({ row: { original: t } }) => (
        <div className="min-w-48">
          <div className="font-medium">{t.description}</div>
          <div className="text-xs text-muted-foreground">
            {[t.docNo, t.vendor, t.progressPaymentNo ? `${t.progressPaymentNo}. hakediş` : null].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      accessorFn: (t) => `${KIND_LABEL[t.kind]} ${t.scope ?? ''} ${t.category ? CATEGORY_LABEL[t.category] : ''}`,
      header: 'Tür',
      cell: ({ row: { original: t } }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={t.kind === 'gider' ? 'default' : t.kind === 'gelir' ? 'positive' : 'info'}>{KIND_LABEL[t.kind]}</Badge>
          {t.scope && <Badge variant={t.scope === 'ortak' ? 'outline' : 'warning'}>{t.scope === 'ortak' ? 'Ortak' : 'Şahsi'}</Badge>}
          {t.category && <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[t.category]}</span>}
        </div>
      ),
    },
  ]
  if (!hideContext) {
    cols.push({
      id: 'context',
      accessorFn: (t) => (t.projectId ? projects.get(t.projectId)?.name : t.propertyId ? properties.get(t.propertyId)?.name : 'Genel') ?? '',
      header: 'Proje / Mülk',
      cell: ({ getValue }) => <span className="text-xs">{getValue() as string}</span>,
    })
  }
  cols.push(
    {
      id: 'payer',
      accessorFn: (t) => payerLabel(t, partners) + (t.receiverPartnerId ? ` → ${partners.get(t.receiverPartnerId)?.name}` : ''),
      header: 'Ödeyen',
      cell: ({ getValue }) => <span className="text-xs whitespace-nowrap">{getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Tutar',
      meta: { align: 'right' },
      cell: ({ row: { original: t } }) => (
        <Money value={t.kind === 'gider' ? -t.amount : t.amount} signed={t.kind !== 'mahsup'} className="font-medium" />
      ),
    },
  )
  if (onDelete || onEdit) {
    cols.push({
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: t } }) => (
        <div className="flex justify-end gap-1">
          {onEdit && (
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(t)} aria-label="Kopyala / düzenle">
              <Pencil className="size-3.5!" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="size-7 text-negative" onClick={() => onDelete(t)} aria-label="Sil">
              <Trash2 className="size-3.5!" />
            </Button>
          )}
        </div>
      ),
    })
  }
  return cols
}
