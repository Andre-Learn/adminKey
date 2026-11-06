export type LicenseStatus = 'active' | 'expired' | 'revoked';
export type EffectiveStatus = 'unactivated' | 'active' | 'expired' | 'revoked';
export type DurationKey = '1h' | '6h' | '12h' | '1d' | '7d' | '30d' | '90d' | 'lifetime' | 'custom';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

// ── Publik (aktivasi) ──
export interface LicenseView {
  id: string;
  status: LicenseStatus;
  is_lifetime: boolean;
  duration_seconds: number | null;
  activated_at: string | null;
  expires_at: string | null;
  max_devices: number;
  devices_used: number;
}
export interface ActivationResponse {
  license: LicenseView;
  server_time: string;
  session_token: string;
}

// ── Admin ──
export interface AdminIdentity {
  id: string;
  email: string | null;
}

export interface License {
  id: string;
  key_hint: string;
  status: LicenseStatus;
  duration_seconds: number | null;
  is_lifetime: boolean;
  max_devices: number;
  note: string | null;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  devices_count: number;
}

export interface Paged {
  page: number;
  page_size: number;
  total: number;
}
export interface LicenseListResponse extends Paged {
  licenses: License[];
}

export interface GeneratedLicense {
  id: string;
  license_key: string;
  key_hint: string;
  created_at: string;
}
export interface GenerateResponse {
  licenses: GeneratedLicense[];
  duration_seconds: number | null;
  is_lifetime: boolean;
  max_devices: number;
}

export interface DeviceRecord {
  id: string;
  license_id: string;
  device_name: string | null;
  platform: string | null;
  last_ip: string | null;
  first_seen_at: string;
  last_seen_at: string;
  licenses: {
    key_hint: string;
    status: LicenseStatus;
    is_lifetime: boolean;
    activated_at: string | null;
    expires_at: string | null;
  } | null;
}
export interface DeviceListResponse extends Paged {
  devices: DeviceRecord[];
}

export type LogAction =
  | 'created'
  | 'first_activation'
  | 'device_registered'
  | 'activate_failed'
  | 'device_deactivated'
  | 'device_removed'
  | 'extended'
  | 'revoked'
  | 'deleted'
  | 'expired';

export interface LogRecord {
  id: number;
  license_id: string | null;
  action: LogAction;
  actor_type: 'system' | 'admin' | 'user';
  actor_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  licenses: { key_hint: string } | null;
}
export interface LogListResponse extends Paged {
  logs: LogRecord[];
}

export interface Stats {
  total: number;
  active: number;
  unactivated: number;
  expired: number;
  revoked: number;
  devices: number;
}
