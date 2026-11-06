import type { EffectiveStatus, License, LogAction } from '@/types';

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Postgres mengirim mikrodetik; sebagian browser hanya menerima milidetik.
  const d = new Date(value.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateTimeFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(value: string | null | undefined): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : '-';
}

const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });

export function relativeTime(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '-';
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'baru saja';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return dateTimeFmt.format(d);
}

export function formatDuration(seconds: number | null, isLifetime: boolean): string {
  if (isLifetime) return 'Lifetime';
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days} hari`);
  if (hours) parts.push(`${hours} jam`);
  if (minutes && !days) parts.push(`${minutes} menit`);
  return parts.join(' ') || `${seconds} detik`;
}

export function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function effectiveStatus(l: Pick<License, 'status' | 'activated_at'>): EffectiveStatus {
  if (l.status === 'active' && !l.activated_at) return 'unactivated';
  return l.status;
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  unactivated: 'Belum diaktivasi',
  active: 'Aktif',
  expired: 'Kedaluwarsa',
  revoked: 'Dicabut',
};

export const ACTION_LABEL: Record<LogAction, string> = {
  created: 'License dibuat',
  first_activation: 'Aktivasi pertama',
  device_registered: 'Perangkat terdaftar',
  activate_failed: 'Aktivasi gagal',
  device_deactivated: 'Perangkat dinonaktifkan user',
  device_removed: 'Perangkat dihapus admin',
  extended: 'License diperpanjang',
  revoked: 'License dicabut',
  deleted: 'License dihapus',
  expired: 'License kedaluwarsa',
};

export function formatKeyInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length <= 4 && 'EPEN'.startsWith(clean)) return clean;
  const body = (clean.startsWith('EPEN') ? clean.slice(4) : clean).slice(0, 12);
  if (!body) return clean;
  return ['EPEN', ...(body.match(/.{1,4}/g) ?? [])].join('-');
}

export const KEY_REGEX = /^EPEN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
