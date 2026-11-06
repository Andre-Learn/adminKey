import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
