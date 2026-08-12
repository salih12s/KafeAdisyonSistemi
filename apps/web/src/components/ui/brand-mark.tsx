import { cn } from '../../lib/cn';

export function BrandMark({ className }: { className?: string }): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className={cn('h-10 w-10', className)}>
      <rect x="4" y="3" width="32" height="34" rx="9" fill="currentColor" />
      <path
        d="M12 12.5h16M12 18h12M12 23.5h16"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M15 32h10" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
