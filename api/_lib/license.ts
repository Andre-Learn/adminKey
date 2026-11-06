import { ApiError } from './http.js';
import { issueSession } from './crypto.js';

export interface LicenseView {
  id: string;
  status: 'active' | 'expired' | 'revoked';
  is_lifetime: boolean;
  duration_seconds: number | null;
  activated_at: string | null;
  expires_at: string | null;
  max_devices: number;
  devices_used: number;
}

export interface RpcOk {
  result: 'ok';
  license: LicenseView;
  server_time: string;
}

export interface RpcFail {
  result: 'invalid' | 'revoked' | 'expired' | 'device_limit' | 'not_activated' | 'device_not_registered';
  expires_at?: string | null;
  max_devices?: number;
}

export type RpcResult = RpcOk | RpcFail;

export function assertOk(r: RpcResult): asserts r is RpcOk {
  if (r.result === 'ok') return;
  switch (r.result) {
    case 'invalid':
      throw new ApiError(404, 'INVALID_KEY', 'License key tidak ditemukan.');
    case 'revoked':
      throw new ApiError(403, 'REVOKED', 'License ini telah dicabut.');
    case 'expired':
      throw new ApiError(403, 'EXPIRED', 'License sudah kedaluwarsa.', { expires_at: r.expires_at ?? null });
    case 'device_limit':
      throw new ApiError(409, 'DEVICE_LIMIT', 'Batas jumlah perangkat untuk license ini sudah tercapai.', {
        max_devices: r.max_devices ?? null,
      });
    case 'not_activated':
      throw new ApiError(403, 'NOT_ACTIVATED', 'License belum diaktivasi.');
    case 'device_not_registered':
      throw new ApiError(403, 'DEVICE_NOT_REGISTERED', 'Perangkat ini belum/tidak lagi terdaftar pada license.');
    default:
      throw new ApiError(500, 'INTERNAL_ERROR', 'Respons database tidak dikenali');
  }
}

export function successPayload(r: RpcOk, deviceHash: string) {
  return {
    license: r.license,
    server_time: r.server_time,
    session_token: issueSession(r.license.id, deviceHash),
  };
}
