import { useId, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './button';
import { Dialog } from './dialog';
import { ErrorText } from './error-text';

/**
 * Form içeren dialogların ortak kabuğu. Kaydet ve Vazgeç (veya Geri) düğmeleri
 * alt barda sabittir; form, düğmeye `form` özniteliğiyle bağlanır.
 */
export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  loading,
  error,
  onClose,
  onSubmit,
  onBack,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
  /** Verildiğinde Vazgeç yerine Geri düğmesi gösterilir. */
  onBack?: () => void;
  children: ReactNode;
}): JSX.Element | null {
  const formId = useId();
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className="sm:max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {onBack === undefined ? (
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={onBack}
              icon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
            >
              Geri
            </Button>
          )}
          <Button type="submit" form={formId} loading={loading}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        aria-label={title}
        className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        {children}
        <div className="sm:col-span-2">
          <ErrorText error={error} />
        </div>
      </form>
    </Dialog>
  );
}
