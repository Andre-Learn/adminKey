import { requireAdmin } from '../../_lib/auth.js';
import { generateLicenseKey, hashLicenseKey, keyHint } from '../../_lib/crypto.js';
import { resolveDuration } from '../../_lib/durations.js';
import { ApiError, parseBody, route, sendOk } from '../../_lib/http.js';
import { generateSchema } from '../../_lib/schemas.js';
import { getSupabase } from '../../_lib/supabase.js';

interface CreatedRow {
  id: string;
  key_hash: string;
  key_hint: string;
  created_at: string;
}

// POST /api/admin/licenses/generate
// Key asli hanya ada di response ini. Database hanya menyimpan hash.
export default route({ methods: ['POST'] }, async (req, res) => {
  const admin = await requireAdmin(req);
  const body = parseBody(req, generateSchema);
  const { isLifetime, seconds } = resolveDuration(body);
  const sb = getSupabase();

  for (let attempt = 0; attempt < 3; attempt++) {
    const keys = new Set<string>();
    while (keys.size < body.count) keys.add(generateLicenseKey());
    const rawKeys = [...keys];

    const { data, error } = await sb.rpc('admin_generate_licenses', {
      p_keys: rawKeys.map((k) => ({ key_hash: hashLicenseKey(k), key_hint: keyHint(k) })),
      p_duration_seconds: seconds,
      p_is_lifetime: isLifetime,
      p_max_devices: body.max_devices,
      p_note: body.note ?? null,
      p_admin_id: admin.id,
    });

    if (error) {
      if (error.code === '23505') continue; // tabrakan hash (sangat jarang) -> ulangi
      console.error('[db] admin_generate_licenses:', error.code, error.message);
      throw new ApiError(500, 'DATABASE_ERROR', 'Gagal membuat license');
    }

    const byHash = new Map(rawKeys.map((k) => [hashLicenseKey(k), k]));
    const licenses = (data as CreatedRow[]).map((row) => ({
      id: row.id,
      license_key: byHash.get(row.key_hash) as string,
      key_hint: row.key_hint,
      created_at: row.created_at,
    }));

    sendOk(
      res,
      { licenses, duration_seconds: seconds, is_lifetime: isLifetime, max_devices: body.max_devices },
      201,
    );
    return;
  }

  throw new ApiError(500, 'KEY_COLLISION', 'Gagal membuat key unik, coba lagi');
});
