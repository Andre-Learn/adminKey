import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
          Coba lagi
        </button>
      )}
    </div>
  );
}
