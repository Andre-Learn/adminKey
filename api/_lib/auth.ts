import type { VercelRequest } from '@vercel/node';
import { ApiError } from './http.js';
import { assertNoError, getSupabase } from './supabase.js';

export interface AdminIdentity {
  id: string;
  email: string | null;
}

/**
 * Verifikasi JWT Supabase Auth, lalu pastikan user ada di tabel `admins`.
 * Memiliki akun Supabase saja TIDAK cukup untuk menjadi admin.
 */
export async function requireAdmin(req: VercelRequest): Promise<AdminIdentity> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Token admin tidak ditemukan');

  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Sesi admin tidak valid atau sudah berakhir');
  }

  const { data: admin, error: adminError } = await sb
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  assertNoError(adminError, 'load admin');
  if (!admin) throw new ApiError(403, 'FORBIDDEN', 'Akun ini tidak memiliki akses admin');

  return { id: data.user.id, email: data.user.email ?? null };
}
