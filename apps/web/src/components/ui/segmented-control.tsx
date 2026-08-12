import { cn } from '../../lib/cn';

interface Segment<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  dark = false,
}: {
  label: string;
  value: T;
  options: readonly Segment<T>[];
  onChange: (value: T) => void;
  dark?: boolean;
}): JSX.Element {
  return (
    <div
      aria-label={label}
      className={cn(
        'scrollbar-quiet flex max-w-full gap-1 overflow-x-auto rounded-input border p-1',
        dark ? 'border-kds-line bg-kds-surface' : 'border-line bg-surface-muted',
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-10 shrink-0 rounded-control px-3 text-sm font-semibold transition',
            value === option.value
              ? dark
                ? 'bg-kds-elevated text-kds-ink shadow-card'
                : 'bg-surface text-primary shadow-card'
              : dark
                ? 'text-kds-muted hover:text-kds-ink'
                : 'text-ink-secondary hover:text-ink',
          )}
        >
          {option.label}
          {option.count === undefined ? null : (
            <span className="ml-1.5 tabular text-xs opacity-75">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
