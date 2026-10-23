import { Button, Dialog, DialogContent } from '@/components/ui'
import { useConfirmStore } from '@/store/useUIStore'

export function ConfirmDialog() {
  const { message, onYes, close } = useConfirmStore()
  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && close()}>
      <DialogContent title="Emin misiniz?" className="sm:max-w-md">
        <p className="text-sm">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={close}>Vazgeç</Button>
          <Button
            variant="destructive"
            onClick={() => {
              onYes?.()
              close()
            }}
          >
            Onayla
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
