import { getDeviceId, getPlatform } from './device';
import { supabase } from './supabase';
import type {
  ActivationResponse,
  AdminIdentity,
  ApiEnvelope,
  DeviceListResponse,
  DurationKey,
  GenerateResponse,
  LicenseListResponse,
  LogAction,
  LogListResponse,
  Stats,
} from '@/types';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Kesalahan sementara (jaringan/server): jangan mengeluarkan user dari sesi. */
  get isTransient(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'RATE_LIMITED' || this.status >= 500;
  }
}

type Query = Record<string, string | number | undefined | null>;

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  opts: { body?: unknown; token?: string; query?: Query } = {},
): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(res.status, 'BAD_RESPONSE', 'Respons server tidak valid.');
  }

  if (!payload.success) {
    const e = payload.error;
    throw new ApiClientError(
      res.status,
      e?.code ?? 'UNKNOWN',
      e?.message ?? 'Terjadi kesalahan.',
      (e?.details as Record<string, unknown> | undefined) ?? undefined,
    );
  }
  return payload.data;
}

async function admin<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  opts: { body?: unknown; query?: Query } = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiClientError(401, 'UNAUTHORIZED', 'Sesi admin berakhir. Silakan login kembali.');
  return request<T>(method, path, { ...opts, token });
}

// ───────── Publik ─────────
export const licenseApi = {
  activate: (licenseKey: string) =>
    request<ActivationResponse>('POST', '/api/license/activate', {
      body: {
        license_key: licenseKey,
        device_id: getDeviceId(),
        device_name: getPlatform(),
        platform: navigator.platform || undefined,
      },
    }),
  verify: (sessionToken: string) =>
    request<ActivationResponse>('POST', '/api/license/verify', { body: { session_token: sessionToken } }),
  deactivate: (sessionToken: string) =>
    request<{ removed: boolean }>('POST', '/api/license/deactivate', { body: { session_token: sessionToken } }),
};

// ───────── Admin ─────────
interface DurationBody {
  duration: DurationKey;
  custom_seconds?: number;
}

export const adminApi = {
  me: () => admin<AdminIdentity>('GET', '/api/admin/me'),
  stats: () => admin<Stats>('GET', '/api/admin/stats'),
  listLicenses: (q: { page: number; page_size: number; status: string; search: string }) =>
    admin<LicenseListResponse>('GET', '/api/admin/licenses', {
      query: { ...q, status: q.status === 'all' ? undefined : q.status },
    }),
  generate: (body: DurationBody & { count: number; max_devices: number; note?: string }) =>
    admin<GenerateResponse>('POST', '/api/admin/licenses/generate', { body }),
  extend: (body: DurationBody & { id: string }) =>
    admin<{ expires_at: string | null }>('POST', '/api/admin/licenses/extend', { body }),
  revoke: (body: { id: string; reason?: string }) =>
    admin<{ id: string }>('POST', '/api/admin/licenses/revoke', { body }),
  remove: (id: string) => admin<{ id: string }>('DELETE', '/api/admin/licenses/delete', { query: { id } }),
  devices: (q: { page: number; page_size: number; license_id?: string }) =>
    admin<DeviceListResponse>('GET', '/api/admin/devices', { query: q }),
  removeDevice: (id: string) => admin<{ id: string }>('POST', '/api/admin/devices/remove', { body: { id } }),
  logs: (q: { page: number; page_size: number; action?: LogAction | '' }) =>
    admin<LogListResponse>('GET', '/api/admin/logs', { query: q }),
};
