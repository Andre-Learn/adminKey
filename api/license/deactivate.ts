import { hashDeviceId, hashLicenseKey, verifySession } from '../_lib/crypto.js';
import { ApiError, getClientIp, parseBody, route, sendOk } from '../_lib/http.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { deactivateSchema } from '../_lib/schemas.js';
import { assertNoError, getSupabase } from '../_lib/supabase.js';

// POST /api/license/deactivate  -> melepas perangkat ini dari license (membebaskan slot)
export default route({ methods: ['POST'], cors: true }, async (req, res) => {
  await rateLimit(req, 'deactivate', 20, 60);
  const body = parseBody(req, deactivateSchema);

  let keyHash: string | null = null;
  let licenseId: string | null = null;
  let deviceHash: string;

  if (body.session_token) {
    const payload = verifySession(body.session_token);
    if (!payload) throw new ApiError(401, 'INVALID_SESSION', 'Sesi aktivasi tidak valid.');
    licenseId = payload.lid;
    deviceHash = payload.dh;
  } else {
    keyHash = hashLicenseKey(body.license_key as string);
    deviceHash = hashDeviceId(body.device_id as string);
  }

  const { data, error } = await getSupabase().rpc('deactivate_device', {
    p_key_hash: keyHash,
    p_license_id: licenseId,
    p_device_hash: deviceHash,
    p_ip: getClientIp(req),
  });
  assertNoError(error, 'deactivate_device');

  sendOk(res, { removed: Boolean((data as { removed?: boolean }).removed) });
});
