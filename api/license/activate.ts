import { hashDeviceId, hashLicenseKey } from '../_lib/crypto.js';
import { getClientIp, parseBody, route, sendOk } from '../_lib/http.js';
import { assertOk, successPayload, type RpcResult } from '../_lib/license.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { activateSchema } from '../_lib/schemas.js';
import { assertNoError, getSupabase } from '../_lib/supabase.js';

// POST /api/license/activate
export default route({ methods: ['POST'], cors: true }, async (req, res) => {
  await rateLimit(req, 'activate', 10, 60);
  const body = parseBody(req, activateSchema);

  const deviceHash = hashDeviceId(body.device_id);
  const { data, error } = await getSupabase().rpc('activate_license', {
    p_key_hash: hashLicenseKey(body.license_key),
    p_device_hash: deviceHash,
    p_device_name: body.device_name ?? null,
    p_platform: body.platform ?? null,
    p_ip: getClientIp(req),
  });
  assertNoError(error, 'activate_license');

  const result = data as RpcResult;
  assertOk(result);
  sendOk(res, successPayload(result, deviceHash));
});
