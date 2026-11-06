import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { env } from './env.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'DELETE';
type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

export function sendOk<T>(res: VercelResponse, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(status).json({
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  if (origin && env.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function handleError(res: VercelResponse, err: unknown): void {
  if (res.headersSent) return;

  if (err instanceof ApiError) {
    const retry = err.details?.retry_after;
    if (err.status === 429 && typeof retry === 'number') {
      res.setHeader('Retry-After', String(retry));
    }
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      err.issues[0]?.message ?? 'Input tidak valid',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
    return;
  }

  // Jangan bocorkan detail internal ke client.
  console.error('[api] unhandled error:', err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server');
}

/** Pembungkus endpoint: method guard, CORS opsional, error handling konsisten. */
export function route(options: { methods: Method[]; cors?: boolean }, fn: Handler): Handler {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (options.cors) applyCors(req, res);
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      if (!req.method || !options.methods.includes(req.method as Method)) {
        res.setHeader('Allow', options.methods.join(', '));
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Gunakan metode ${options.methods.join(' atau ')}`);
      }
      await fn(req, res);
    } catch (err) {
      handleError(res, err);
    }
  };
}

export function readBody(req: VercelRequest): unknown {
  try {
    const body: unknown = req.body;
    if (body === undefined || body === null || body === '') return {};
    if (typeof body === 'string') return JSON.parse(body);
    return body;
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Body request harus berupa JSON yang valid');
  }
}

export function parseBody<S extends ZodTypeAny>(req: VercelRequest, schema: S): z.infer<S> {
  return schema.parse(readBody(req));
}

export function getClientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  const first = raw?.split(',')[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real.slice(0, 64);
  return req.socket?.remoteAddress?.slice(0, 64) ?? 'unknown';
}
