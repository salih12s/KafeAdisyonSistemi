import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

export const fieldControlStyles =
  'min-h-touch w-full rounded-input border border-line-strong bg-surface px-3 text-sm text-ink transition placeholder:text-ink-subtle hover:border-line-strong focus:border-focus disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle';

interface FieldFrameProps {
  label: string;
  htmlFor: string;
  helper?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldFrame({
  label,
  htmlFor,
  helper,
  error,
  required,
  className,
  children,
}: FieldFrameProps): JSX.Element {
  const detailId = helper !== undefined || error !== undefined ? `${htmlFor}-detail` : undefined;
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <label className="text-[13px] font-semibold text-ink" htmlFor={htmlFor}>
        {label}
        {required === true ? (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error !== undefined ? (
        <p id={detailId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : helper !== undefined ? (
        <p id={detailId} className="text-xs text-ink-secondary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'prefix'> {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  containerClassName?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function TextField({
  id,
  label,
  helper,
  error,
  containerClassName,
  prefix,
  suffix,
  className,
  required,
  ...props
}: TextFieldProps): JSX.Element {
  const detailId = helper !== undefined || error !== undefined ? `${id}-detail` : undefined;
  return (
    <FieldFrame
      htmlFor={id}
      label={label}
      helper={helper}
      error={error}
      required={required}
      className={containerClassName}
    >
      <span className="relative flex items-center">
        {prefix === undefined ? null : (
          <span className="pointer-events-none absolute left-3 text-ink-secondary">{prefix}</span>
        )}
        <input
          id={id}
          aria-label={label}
          required={required}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={detailId}
          className={cn(
            fieldControlStyles,
            prefix === undefined ? '' : 'pl-10',
            suffix === undefined ? '' : 'pr-10',
            className,
          )}
          {...props}
        />
        {suffix === undefined ? null : <span className="absolute right-2">{suffix}</span>}
      </span>
    </FieldFrame>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  containerClassName?: string;
}

export function SelectField({
  id,
  label,
  helper,
  error,
  containerClassName,
  className,
  required,
  children,
  ...props
}: SelectFieldProps): JSX.Element {
  return (
    <FieldFrame
      htmlFor={id}
      label={label}
      helper={helper}
      error={error}
      required={required}
      className={containerClassName}
    >
      <select
        id={id}
        aria-label={label}
        required={required}
        className={cn(fieldControlStyles, className)}
        {...props}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  containerClassName?: string;
}

export function TextareaField({
  id,
  label,
  helper,
  error,
  containerClassName,
  className,
  required,
  ...props
}: TextareaFieldProps): JSX.Element {
  return (
    <FieldFrame
      htmlFor={id}
      label={label}
      helper={helper}
      error={error}
      required={required}
      className={containerClassName}
    >
      <textarea
        id={id}
        aria-label={label}
        required={required}
        className={cn(fieldControlStyles, 'min-h-24 py-2.5', className)}
        {...props}
      />
    </FieldFrame>
  );
}
