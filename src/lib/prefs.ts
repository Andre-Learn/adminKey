import type { DurationKey } from '@/types';

const KEY = 'epen.admin_prefs';

export interface Prefs {
  defaultDuration: Exclude<DurationKey, 'custom'>;
  defaultMaxDevices: number;
}

const DEFAULTS: Prefs = { defaultDuration: '30d', defaultMaxDevices: 1 };

/** Preferensi tampilan admin saja (bukan data lisensi). */
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}
