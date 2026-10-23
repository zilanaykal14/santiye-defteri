import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button, Select, TD, TR } from '@/components/ui'
import { Money, PageHeader } from '@/components/shared'
import { DataTable } from '@/components/shared/DataTable'
import { useAppStore } from '@/store/useAppStore'
import { askConfirm } from '@/store/useUIStore'
import { useUIStore } from '@/store/useUIStore'
import { KIND_LABEL } from '@/lib/labels'
import { useCan } from '@/store/useAuthStore'
import { transactionColumns } from './columns'
import type { TransactionKind } from '@/types'

export function TransactionsPage() {
  const { transactions, partners, projects, properties, remove } = useAppStore()
  const openTx = useUIStore((s) => s.openTxDialog)
  const can = useCan()
  const [kind, setKind] = React.useState<TransactionKind | ''>('')
  const [scope, setScope] = React.useState('')
  const [projectId, setProjectId] = React.useState('')

  const data = transactions.filter(
    (t) =>
      (!kind || t.kind === kind) &&
      (!scope || t.scope === scope) &&
      (!projectId || (projectId === 'mulk' ? !!t.propertyId : t.projectId === projectId)),
  )
  const columns = React.useMemo(
    () =>
      transactionColumns({
        partners: new Map(partners.map((p) => [p.id, p])),
        projects: new Map(projects.map((p) => [p.id, p])),
        properties: new Map(properties.map((p) => [p.id, p])),
        onEdit: (tx) => {
          const { id, createdAt: _c, ...rest } = tx
          void _c
          openTx(rest, id)
        },
        onDelete: (tx) => askConfirm(`"${tx.description}" silinsin mi?`, () => { remove('transactions', tx.id) }),
      }),
    [partners, projects, properties, openTx, remove],
  )
  const gider = data.filter((t) => t.kind === 'gider').reduce((a, t) => a + t.amount, 0)
  const gelir = data.filter((t) => t.kind === 'gelir').reduce((a, t) => a + t.amount, 0)

  return (
    <>
      <PageHeader
        title="Tüm İşlemler"
        description="Gider, gelir, sermaye ve ortaklar arası ödemelerin tamamı"
        actions={
          can.add && (
            <Button onClick={() => openTx()}>
              <Plus /> Yeni işlem
            </Button>
          )
        }
      />
      <DataTable
        data={data}
        columns={columns}
        pageSize={20}
        initialSorting={[{ id: 'date', desc: true }]}
        searchPlaceholder="Açıklama, fatura no, firma…"
        toolbar={
          <>
            <Select value={kind} onChange={(e) => setKind(e.target.value as TransactionKind | '')} className="w-40">
              <option value="">Tüm türler</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-36">
              <option value="">Ortak + Şahsi</option>
              <option value="ortak">Ortak</option>
              <option value="sahsi">Şahsi</option>
            </Select>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-48">
              <option value="">Tüm projeler / mülkler</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="mulk">Mülk giderleri</option>
            </Select>
          </>
        }
        footer={
          <TR>
            <TD colSpan={5} className="text-right text-xs text-muted-foreground">Filtrelenen toplam gider / gelir</TD>
            <TD className="text-right">
              <div><Money value={-gider} signed /></div>
              <div><Money value={gelir} signed /></div>
            </TD>
            <TD />
          </TR>
        }
      />
    </>
  )
}
