import { requireAdmin } from '../../_lib/auth.js';
import { ApiError, readBody, route, sendOk } from '../../_lib/http.js';
import { idSchema } from '../../_lib/schemas.js';
import { assertNoError, getSupabase } from '../../_lib/supabase.js';

// DELETE /api/admin/licenses/delete?id=<uuid>   (atau body JSON { "id": "<uuid>" })
export default route({ methods: ['DELETE'] }, async (req, res) => {
  const admin = await requireAdmin(req);

  const fromQuery = typeof req.query.id === 'string' ? req.query.id : undefined;
  const fromBody = (readBody(req) as { id?: unknown }).id;
  const { id } = idSchema.parse({ id: fromQuery ?? fromBody });

  const { data, error } = await getSupabase().rpc('admin_delete_license', {
    p_license_id: id,
    p_admin_id: admin.id,
  });
  assertNoError(error, 'admin_delete_license');

  if ((data as { result: string }).result === 'not_found') {
    throw new ApiError(404, 'NOT_FOUND', 'License tidak ditemukan');
  }
  sendOk(res, { id });
});
