import { requireAdmin } from '../_lib/auth.js';
import { route, sendOk } from '../_lib/http.js';
import { listLogsQuery } from '../_lib/schemas.js';
import { assertNoError, getSupabase } from '../_lib/supabase.js';

// GET /api/admin/logs?page=1&page_size=20&action=
export default route({ methods: ['GET'] }, async (req, res) => {
  await requireAdmin(req);
  const q = listLogsQuery.parse(req.query);

  let query = getSupabase()
    .from('license_logs')
    .select('id, license_id, action, actor_type, actor_id, ip, metadata, created_at, licenses(key_hint)', {
      count: 'exact',
    });
  if (q.action) query = query.eq('action', q.action);

  const from = (q.page - 1) * q.page_size;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + q.page_size - 1);
  assertNoError(error, 'list logs');

  sendOk(res, { logs: data ?? [], page: q.page, page_size: q.page_size, total: count ?? 0 });
});
