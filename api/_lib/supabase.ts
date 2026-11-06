import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './http.js';
import { env } from './env.js';

let client: SupabaseClient | null = null;

/** Client server-side dengan service role key. Tidak pernah dikirim ke browser. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

/** Log error asli di server, kirim pesan generik ke client. */
export function assertNoError(error: { message: string; code?: string } | null, context: string): void {
  if (error) {
    console.error(`[db] ${context}:`, error.code, error.message);
    throw new ApiError(500, 'DATABASE_ERROR', 'Terjadi kesalahan database');
  }
}
