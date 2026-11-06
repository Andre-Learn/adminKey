import { requireAdmin } from '../../_lib/auth.js';
import { hashLicenseKey, KEY_REGEX, normalizeKey } from '../../_lib/crypto.js';
import { route, sendOk } from '../../_lib/http.js';
import { listLicensesQuery } from '../../_lib/schemas.js';
import { assertNoError, getSupabase } from '../../_lib/supabase.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/licenses?page=1&page_size=20&status=all&search=
export default route({ methods: ['GET'] }, async (req, res) => {
  await requireAdmin(req);
  const q = listLicensesQuery.parse(req.query);
  const sb = getSupabase();

  // Pastikan status expired akurat sebelum difilter.
  const { error: expireError } = await sb.rpc('expire_overdue_licenses');
  assertNoError(expireError, 'expire_overdue_licenses');

  let query = sb
    .from('licenses')
    .select(
      'id, key_hint, status, duration_seconds, is_lifetime, max_devices, note, created_at, activated_at, expires_at, revoked_at, license_devices(count)',
      { count: 'exact' },
    );

  switch (q.status) {
    case 'unactivated':
      query = query.eq('status', 'active').is('activated_at', null);
      break;
    case 'active':
      query = query.eq('status', 'active').not('activated_at', 'is', null);
      break;
    case 'expired':
    case 'revoked':
      query = query.eq('status', q.status);
      break;
    default:
      break;
  }

  if (q.search) {
    const normalized = normalizeKey(q.search);
    if (KEY_REGEX.test(normalized)) {
      // Key lengkap: cari lewat hash (key asli tidak tersimpan).
      query = query.eq('key_hash', hashLicenseKey(normalized));
    } else {
      const safe = q.search.replace(/[%,()*\\"'`]/g, ' ').trim();
      if (safe) {
        const filters = [`note.ilike.*${safe}*`, `key_hint.ilike.*${safe}*`];
        if (UUID_REGEX.test(safe)) filters.push(`id.eq.${safe}`);
        query = query.or(filters.join(','));
      }
    }
  }

  const from = (q.page - 1) * q.page_size;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + q.page_size - 1);
  assertNoError(error, 'list licenses');

  const licenses = (data ?? []).map((row) => {
    const { license_devices, ...rest } = row as typeof row & { license_devices?: { count: number }[] };
    return { ...rest, devices_count: license_devices?.[0]?.count ?? 0 };
  });

  sendOk(res, { licenses, page: q.page, page_size: q.page_size, total: count ?? 0 });
});
