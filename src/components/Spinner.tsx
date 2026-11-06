import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;
}

export function FullPageSpinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-muted" role="status">
      <Spinner className="size-5" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
