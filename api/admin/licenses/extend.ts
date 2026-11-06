import { requireAdmin } from '../../_lib/auth.js';
import { resolveDuration } from '../../_lib/durations.js';
import { ApiError, parseBody, route, sendOk } from '../../_lib/http.js';
import { extendSchema } from '../../_lib/schemas.js';
import { assertNoError, getSupabase } from '../../_lib/supabase.js';

// POST /api/admin/licenses/extend
export default route({ methods: ['POST'] }, async (req, res) => {
  const admin = await requireAdmin(req);
  const body = parseBody(req, extendSchema);
  const { isLifetime, seconds } = resolveDuration(body);

  const { data, error } = await getSupabase().rpc('admin_extend_license', {
    p_license_id: body.id,
    p_seconds: seconds,
    p_lifetime: isLifetime,
    p_admin_id: admin.id,
  });
  assertNoError(error, 'admin_extend_license');

  const result = data as { result: string };
  switch (result.result) {
    case 'ok':
      sendOk(res, data);
      return;
    case 'not_found':
      throw new ApiError(404, 'NOT_FOUND', 'License tidak ditemukan');
    case 'revoked':
      throw new ApiError(409, 'REVOKED', 'License yang sudah dicabut tidak bisa diperpanjang');
    case 'already_lifetime':
      throw new ApiError(409, 'ALREADY_LIFETIME', 'License sudah lifetime');
    case 'too_long':
      throw new ApiError(400, 'TOO_LONG', 'Total masa aktif tidak boleh melebihi 10 tahun');
    default:
      throw new ApiError(400, 'INVALID_DURATION', 'Durasi tidak valid');
  }
});
