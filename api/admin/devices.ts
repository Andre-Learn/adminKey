import { requireAdmin } from '../_lib/auth.js';
import { ApiError, readBody, route, sendOk } from '../_lib/http.js';
import { idSchema, listDevicesQuery } from '../_lib/schemas.js';
import { assertNoError, getSupabase } from '../_lib/supabase.js';

// GET    /api/admin/devices?page=1&page_size=20&license_id=<uuid>  -> daftar perangkat
// DELETE /api/admin/devices?id=<device uuid>                       -> hapus perangkat (bebaskan slot)
export default route({ methods: ['GET', 'DELETE'] }, async (req, res) => {
  const admin = await requireAdmin(req);
  const sb = getSupabase();

  if (req.method === 'DELETE') {
    const fromQuery = typeof req.query.id === 'string' ? req.query.id : undefined;
    const fromBody = (readBody(req) as { id?: unknown }).id;
    const { id } = idSchema.parse({ id: fromQuery ?? fromBody });

    const { data, error } = await sb.rpc('admin_remove_device', { p_device_id: id, p_admin_id: admin.id });
    assertNoError(error, 'admin_remove_device');
    if ((data as { result: string }).result === 'not_found') {
      throw new ApiError(404, 'NOT_FOUND', 'Perangkat tidak ditemukan');
    }
    sendOk(res, { id });
    return;
  }

  const q = listDevicesQuery.parse(req.query);
  let query = sb
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
