import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './button';

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-panel border border-danger/25 bg-danger-soft p-4 text-danger sm:flex-row sm:items-center"
    >
      <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed">{description}</p>
      </div>
      {onRetry === undefined ? null : (
        <Button
          variant="outline"
          icon={<RotateCw aria-hidden="true" className="h-4 w-4" />}
          onClick={onRetry}
        >
          Tekrar dene
        </Button>
      )}
    </div>
  );
}
