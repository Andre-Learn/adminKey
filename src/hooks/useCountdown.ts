import { useEffect, useState } from 'react';
import { toDate } from '@/lib/format';

/**
 * Sisa milidetik menuju expiresAt, memakai offset (waktu server - waktu klien)
 * sehingga jam perangkat yang salah tidak mempengaruhi hitungan.
 */
export function useCountdown(expiresAt: string | null, offsetMs: number, enabled = true): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !expiresAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, enabled]);

  const target = toDate(expiresAt)?.getTime();
  if (target === undefined) return null;
  return Math.max(0, target - (now + offsetMs));
}
