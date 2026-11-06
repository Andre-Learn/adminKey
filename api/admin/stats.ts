import { requireAdmin } from '../_lib/auth.js';
import { route, sendOk } from '../_lib/http.js';
import { assertNoError, getSupabase } from '../_lib/supabase.js';

// GET /api/admin/stats
export default route({ methods: ['GET'] }, async (req, res) => {
  await requireAdmin(req);
  const { data, error } = await getSupabase().rpc('admin_dashboard_stats');
  assertNoError(error, 'admin_dashboard_stats');
  sendOk(res, data);
});
