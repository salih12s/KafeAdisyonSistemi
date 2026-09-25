import { Dialog } from './dialog';
import { Button } from './button';
import type { ButtonVariant } from './button-styles';

/**
 * Geri alınması zor bir işlemi onaylatan küçük dialog.
 * Kayıt silme yerine pasife alma gibi işlemlerde ne olacağını açıkça yazar.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel,
  confirmVariant = 'primary',
  loading = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  /** Onaydan sonra ne olacağını anlatan ek açıklama. */
  detail?: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}): JSX.Element | null {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className="sm:max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" variant={confirmVariant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 p-4 sm:p-5">
        {detail === undefined ? null : (
          <p className="rounded-card border border-line bg-canvas p-3 text-sm leading-6 text-ink-secondary">
            {detail}
          </p>
        )}
        {error === undefined ? null : (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
