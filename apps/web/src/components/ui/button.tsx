import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buttonStyles, type ButtonSize, type ButtonVariant } from './button-styles';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  className,
  disabled,
  children,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(buttonStyles(variant, size), className)}
      disabled={disabled === true || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
