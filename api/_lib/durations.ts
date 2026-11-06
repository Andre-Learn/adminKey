export const DURATION_SECONDS = {
  '1h': 3600,
  '6h': 6 * 3600,
  '12h': 12 * 3600,
  '1d': 86400,
  '7d': 7 * 86400,
  '30d': 30 * 86400,
  '90d': 90 * 86400,
} as const;

export const MAX_DURATION_SECONDS = 10 * 365 * 86400; // 10 tahun
export const MIN_DURATION_SECONDS = 60;

export type DurationKey = keyof typeof DURATION_SECONDS | 'lifetime' | 'custom';

export const DURATION_KEYS = [
  '1h', '6h', '12h', '1d', '7d', '30d', '90d', 'lifetime', 'custom',
] as const;

export function resolveDuration(input: { duration: DurationKey; custom_seconds?: number }): {
  isLifetime: boolean;
  seconds: number | null;
} {
  if (input.duration === 'lifetime') return { isLifetime: true, seconds: null };
  if (input.duration === 'custom') return { isLifetime: false, seconds: input.custom_seconds ?? 0 };
  return { isLifetime: false, seconds: DURATION_SECONDS[input.duration] };
}
