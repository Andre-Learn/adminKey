import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

// Tanpa karakter ambigu (0/O, 1/I) agar mudah dibaca.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const KEY_REGEX = /^EPEN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function generateLicenseKey(): string {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `EPEN-${group()}-${group()}-${group()}`;
}

export function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase();
}

function hmacHex(namespace: string, value: string): string {
  return createHmac('sha256', env.hashSecret).update(`${namespace}:${value}`).digest('hex');
}

/** HMAC-SHA256 dengan pepper server. Key asli tidak pernah disimpan. */
export const hashLicenseKey = (key: string): string => hmacHex('license', normalizeKey(key));
export const hashDeviceId = (deviceId: string): string => hmacHex('device', deviceId.trim());
export const hashForRateLimit = (value: string): string => hmacHex('ratelimit', value);

export function keyHint(key: string): string {
  return `EPEN-****-****-${key.slice(-4)}`;
}

// ───────── Session token (ditandatangani HMAC) ─────────
// Token HANYA penunjuk ke license + perangkat. Status sebenarnya selalu dicek ke database.

interface SessionPayload {
  lid: string; // license id
  dh: string; // device hash
  iat: number;
  exp: number;
}

const SESSION_TTL_SECONDS = 30 * 24 * 3600;

function sign(body: string): Buffer {
  return createHmac('sha256', env.sessionSecret).update(body).digest();
}

export function issueSession(licenseId: string, deviceHash: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { lid: licenseId, dh: deviceHash, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body).toString('base64url')}`;
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];

  const expected = sign(body);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (
      typeof p.lid !== 'string' ||
      typeof p.dh !== 'string' ||
      typeof p.iat !== 'number' ||
      typeof p.exp !== 'number'
    ) {
      return null;
    }
    if (p.exp * 1000 < Date.now()) return null;
    return p as SessionPayload;
  } catch {
    return null;
  }
}
