import { cn } from '../../../shared/lib/cn';
import { Badge } from '../../../shared/ui/badge';

export function Summary({
  label,
  value,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning';
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('surface-card flex items-center justify-between px-4 py-3', className)}>
      <span className="text-sm font-semibold text-ink-secondary">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
