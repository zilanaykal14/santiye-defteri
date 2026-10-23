import { Dialog, DialogContent } from '@/components/ui'
import { useUIStore } from '@/store/useUIStore'
import { TransactionForm } from './TransactionForm'

/** Uygulama genelinde tek "Yeni İşlem" modalı */
export function TransactionDialog({ onClosed }: { onClosed?: () => void }) {
  const { txDialogOpen, txDefaults, txEditId, closeTxDialog } = useUIStore()
  const close = () => {
    closeTxDialog()
    onClosed?.()
  }
  return (
    <Dialog open={txDialogOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent
        title={txEditId ? 'İşlemi düzenle' : 'Yeni İşlem'}
        description="Gider, gelir, sermaye veya ortaklar arası ödeme kaydı"
        className="sm:max-w-3xl"
      >
        {/* key: her açılışta form sıfırlanır */}
        <TransactionForm key={JSON.stringify(txDefaults) + String(txDialogOpen)} defaults={txDefaults} editId={txEditId} onDone={close} />
      </DialogContent>
    </Dialog>
  )
}
