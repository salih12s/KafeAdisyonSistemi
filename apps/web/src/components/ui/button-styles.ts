import { cn } from '../../lib/cn';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'danger' | 'subtle';
export type ButtonSize = 'small' | 'medium' | 'large' | 'touch';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover active:bg-primary-pressed',
  secondary: 'border-line-strong bg-surface text-ink hover:bg-surface-muted',
  outline: 'border-line-strong bg-transparent text-ink hover:border-primary hover:text-primary',
  ghost:
    'border-transparent bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink',
  success: 'border-success bg-success text-white hover:brightness-95',
  danger: 'border-danger bg-danger text-white hover:brightness-95',
  subtle: 'border-transparent bg-primary-soft text-primary hover:border-primary/25',
};

const SIZES: Record<ButtonSize, string> = {
  small: 'min-h-9 px-3 text-xs',
  medium: 'min-h-touch px-4 text-sm',
  large: 'min-h-12 px-5 text-[15px]',
  touch: 'min-h-touch px-5 text-sm',
};

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'medium',
): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-input border font-semibold transition disabled:pointer-events-none disabled:opacity-50 active:scale-[.985]',
    VARIANTS[variant],
    SIZES[size],
  );
}
