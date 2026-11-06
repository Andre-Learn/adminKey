import { requireAdmin } from '../../_lib/auth.js';
import { route, sendOk } from '../../_lib/http.js';
import { listDevicesQuery } from '../../_lib/schemas.js';
import { assertNoError, getSupabase } from '../../_lib/supabase.js';

// GET /api/admin/devices?page=1&page_size=20&license_id=<uuid>
export default route({ methods: ['GET'] }, async (req, res) => {
  await requireAdmin(req);
  const q = listDevicesQuery.parse(req.query);

  let query = getSupabase()
    .from('license_devices')
    .select(
      'id, license_id, device_name, platform, last_ip, first_seen_at, last_seen_at, licenses(key_hint, status, is_lifetime, activated_at, expires_at)',
      { count: 'exact' },
    );
  if (q.license_id) query = query.eq('license_id', q.license_id);

  const from = (q.page - 1) * q.page_size;
  const { data, error, count } = await query
    .order('last_seen_at', { ascending: false })
    .range(from, from + q.page_size - 1);
  assertNoError(error, 'list devices');

  sendOk(res, { devices: data ?? [], page: q.page, page_size: q.page_size, total: count ?? 0 });
});
