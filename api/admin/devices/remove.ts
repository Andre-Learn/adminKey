import { requireAdmin } from '../../_lib/auth.js';
import { ApiError, parseBody, route, sendOk } from '../../_lib/http.js';
import { idSchema } from '../../_lib/schemas.js';
import { assertNoError, getSupabase } from '../../_lib/supabase.js';

// POST /api/admin/devices/remove   { "id": "<device uuid>" }
export default route({ methods: ['POST'] }, async (req, res) => {
  const admin = await requireAdmin(req);
  const body = parseBody(req, idSchema);

  const { data, error } = await getSupabase().rpc('admin_remove_device', {
    p_device_id: body.id,
    p_admin_id: admin.id,
  });
  assertNoError(error, 'admin_remove_device');

  if ((data as { result: string }).result === 'not_found') {
    throw new ApiError(404, 'NOT_FOUND', 'Perangkat tidak ditemukan');
  }
  sendOk(res, { id: body.id });
});
