import { hashDeviceId, hashLicenseKey, verifySession } from '../_lib/crypto.js';
import { ApiError, getClientIp, parseBody, route, sendOk } from '../_lib/http.js';
import { assertOk, successPayload, type RpcResult } from '../_lib/license.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { verifySchema } from '../_lib/schemas.js';
import { assertNoError, getSupabase } from '../_lib/supabase.js';

// POST /api/license/verify
export default route({ methods: ['POST'], cors: true }, async (req, res) => {
  await rateLimit(req, 'verify', 60, 60);
  const body = parseBody(req, verifySchema);

  let keyHash: string | null = null;
  let licenseId: string | null = null;
  let deviceHash: string;

  if (body.session_token) {
    const payload = verifySession(body.session_token);
    if (!payload) {
      throw new ApiError(401, 'INVALID_SESSION', 'Sesi aktivasi tidak valid. Silakan aktivasi ulang.');
    }
    licenseId = payload.lid;
    deviceHash = payload.dh;
  } else {
    keyHash = hashLicenseKey(body.license_key as string);
    deviceHash = hashDeviceId(body.device_id as string);
  }

  // Status selalu diambil dari database, bukan dari token / localStorage.
  const { data, error } = await getSupabase().rpc('verify_license', {
    p_key_hash: keyHash,
    p_license_id: licenseId,
    p_device_hash: deviceHash,
    p_ip: getClientIp(req),
  });
  assertNoError(error, 'verify_license');

  const result = data as RpcResult;
  assertOk(result);
  sendOk(res, successPayload(result, deviceHash));
});
