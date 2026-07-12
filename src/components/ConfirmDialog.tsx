import { Modal } from './Modal'
import { Button } from './forms'

export function ConfirmDialog({
  open,
  title = 'Επιβεβαίωση',
  message,
  confirmLabel = 'Διαγραφή',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Ακύρωση
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  )
}
