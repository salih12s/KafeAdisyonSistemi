import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn('block animate-pulse rounded-control bg-surface-muted', className)}
    />
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }): JSX.Element {
  return (
    <div role="status" aria-label="İçerik yükleniyor" className="surface-card space-y-3 p-4">
      <Skeleton className="h-5 w-36" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}
