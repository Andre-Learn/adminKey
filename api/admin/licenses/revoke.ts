import { requireAdmin } from '../../_lib/auth.js';
import { ApiError, parseBody, route, sendOk } from '../../_lib/http.js';
import { revokeSchema } from '../../_lib/schemas.js';
import { assertNoError, getSupabase } from '../../_lib/supabase.js';

// POST /api/admin/licenses/revoke
export default route({ methods: ['POST'] }, async (req, res) => {
  const admin = await requireAdmin(req);
  const body = parseBody(req, revokeSchema);

  const { data, error } = await getSupabase().rpc('admin_revoke_license', {
    p_license_id: body.id,
    p_reason: body.reason ?? null,
    p_admin_id: admin.id,
  });
  assertNoError(error, 'admin_revoke_license');

  const result = data as { result: string };
  if (result.result === 'not_found') throw new ApiError(404, 'NOT_FOUND', 'License tidak ditemukan');
  if (result.result === 'already_revoked') throw new ApiError(409, 'ALREADY_REVOKED', 'License sudah dicabut');
  sendOk(res, data);
});
