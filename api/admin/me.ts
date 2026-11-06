import { requireAdmin } from '../_lib/auth.js';
import { route, sendOk } from '../_lib/http.js';

// GET /api/admin/me
export default route({ methods: ['GET'] }, async (req, res) => {
  const admin = await requireAdmin(req);
  sendOk(res, admin);
});
