import Modal from './Modal';
import Button from './ui/Button';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mb-5 text-[13px] text-[var(--color-text-secondary)]">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
