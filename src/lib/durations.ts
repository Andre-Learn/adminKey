import type { DurationKey } from '@/types';

export const DURATION_OPTIONS: { key: DurationKey; label: string }[] = [
  { key: '1h', label: '1 jam' },
  { key: '6h', label: '6 jam' },
  { key: '12h', label: '12 jam' },
  { key: '1d', label: '1 hari' },
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: '90d', label: '90 hari' },
  { key: 'lifetime', label: 'Lifetime' },
  { key: 'custom', label: 'Custom' },
];

export type CustomUnit = 'minutes' | 'hours' | 'days';

export const UNIT_SECONDS: Record<CustomUnit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
};

export const UNIT_LABEL: Record<CustomUnit, string> = {
  minutes: 'Menit',
  hours: 'Jam',
  days: 'Hari',
};

export const MIN_SECONDS = 60;
export const MAX_SECONDS = 10 * 365 * 86400;

export interface DurationState {
  duration: DurationKey;
  customAmount: number;
  customUnit: CustomUnit;
}

export const defaultDurationState: DurationState = { duration: '30d', customAmount: 2, customUnit: 'days' };

export function toDurationPayload(s: DurationState): { duration: DurationKey; custom_seconds?: number } {
  if (s.duration !== 'custom') return { duration: s.duration };
  return { duration: 'custom', custom_seconds: Math.round(s.customAmount * UNIT_SECONDS[s.customUnit]) };
}

export function validateDuration(s: DurationState): string | null {
  if (s.duration !== 'custom') return null;
  const seconds = s.customAmount * UNIT_SECONDS[s.customUnit];
  if (!Number.isFinite(seconds) || seconds < MIN_SECONDS) return 'Durasi custom minimal 1 menit.';
  if (seconds > MAX_SECONDS) return 'Durasi custom maksimal 10 tahun.';
  return null;
}
