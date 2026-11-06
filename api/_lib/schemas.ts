import { z } from 'zod';
import { KEY_REGEX, normalizeKey } from './crypto.js';
import { DURATION_KEYS, MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from './durations.js';

const licenseKey = z
  .string({ required_error: 'license_key wajib diisi' })
  .max(64, 'license_key terlalu panjang')
  .transform(normalizeKey)
  .pipe(z.string().regex(KEY_REGEX, 'Format key harus EPEN-XXXX-XXXX-XXXX'));

const deviceId = z.string().trim().min(8, 'device_id minimal 8 karakter').max(128);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const activateSchema = z.object({
  license_key: licenseKey,
  device_id: deviceId,
  device_name: optionalText(100),
  platform: optionalText(100),
});

// verify & deactivate: pakai session_token ATAU (license_key + device_id)
const sessionOrKey = z
  .object({
    session_token: z.string().max(1024).optional(),
    license_key: licenseKey.optional(),
    device_id: deviceId.optional(),
  })
  .refine((v) => Boolean(v.session_token) || (Boolean(v.license_key) && Boolean(v.device_id)), {
    message: 'Kirim session_token, atau license_key beserta device_id',
  });

export const verifySchema = sessionOrKey;
export const deactivateSchema = sessionOrKey;

const durationShape = {
  duration: z.enum(DURATION_KEYS),
  custom_seconds: z
    .number()
    .int()
    .min(MIN_DURATION_SECONDS, 'Durasi custom minimal 1 menit')
    .max(MAX_DURATION_SECONDS, 'Durasi custom maksimal 10 tahun')
    .optional(),
};

function requireCustomSeconds(v: { duration: string; custom_seconds?: number }, ctx: z.RefinementCtx) {
  if (v.duration === 'custom' && v.custom_seconds === undefined) {
    ctx.addIssue({ code: 'custom', path: ['custom_seconds'], message: 'custom_seconds wajib untuk durasi custom' });
  }
}

export const generateSchema = z
  .object({
    ...durationShape,
    count: z.number().int().min(1).max(100).default(1),
    max_devices: z.number().int().min(1).max(1000).default(1),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine(requireCustomSeconds);

export const extendSchema = z
  .object({ id: z.string().uuid('id tidak valid'), ...durationShape })
  .superRefine(requireCustomSeconds);

export const revokeSchema = z.object({
  id: z.string().uuid('id tidak valid'),
  reason: z.string().trim().max(300).optional(),
});

export const idSchema = z.object({ id: z.string().uuid('id tidak valid') });

const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
};

export const listLicensesQuery = z.object({
  ...paging,
  status: z.enum(['all', 'unactivated', 'active', 'expired', 'revoked']).default('all'),
  search: z.string().trim().max(100).optional(),
});

export const listDevicesQuery = z.object({
  ...paging,
  license_id: z.string().uuid().optional(),
});

export const listLogsQuery = z.object({
  ...paging,
  action: z
    .enum([
      'created', 'first_activation', 'device_registered', 'activate_failed',
      'device_deactivated', 'device_removed', 'extended', 'revoked', 'deleted', 'expired',
    ])
    .optional(),
});
