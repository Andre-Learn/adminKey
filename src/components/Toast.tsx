import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

type Tone = 'success' | 'error';
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<(tone: Tone, message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: Tone, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg border border-line bg-raised px-4 py-3 text-sm shadow-lg"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 shrink-0 text-bad" aria-hidden="true" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return useMemo(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
    }),
    [push],
  );
}
