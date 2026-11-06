import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmModal({ title, description, confirmLabel, danger, onConfirm, onClose, children }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
      setLoading(false);
    }
  }

  return (
    <Modal title={title} description={description} onClose={onClose}>
      {children}
      {error && (
        <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Batal
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={handle} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
