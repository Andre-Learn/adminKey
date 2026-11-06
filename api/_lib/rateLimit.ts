import type { VercelRequest } from '@vercel/node';
import { hashForRateLimit } from './crypto.js';
import { ApiError, getClientIp } from './http.js';
import { assertNoError, getSupabase } from './supabase.js';

/**
 * Rate limit per IP, tersimpan di Postgres sehingga konsisten antar instance serverless.
 * IP di-hash sebelum disimpan sebagai key.
 */
export async function rateLimit(
  req: VercelRequest,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const key = `${scope}:${hashForRateLimit(getClientIp(req))}`;
  const { data, error } = await getSupabase().rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  assertNoError(error, 'check_rate_limit');

  const result = data as { allowed: boolean; retry_after: number };
  if (!result.allowed) {
    throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi sebentar lagi.', {
      retry_after: result.retry_after,
    });
  }
}
