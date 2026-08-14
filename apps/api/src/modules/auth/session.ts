import { createHmac, timingSafeEqual } from 'node:crypto';

export type SessionRole = 'OPERATOR' | 'EXECUTOR' | 'FUND';
export type SessionUser = { id: string; role: SessionRole; expiresAt: number };

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function secret() {
  return process.env.AUTH_SESSION_SECRET ?? process.env.DATABASE_URL ?? 'xlyq-fund-relay-local-session-secret';
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function issueSessionToken(id: string, role: SessionRole) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ id, role, expiresAt }), 'utf8').toString('base64url');
  return `v1.${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string): SessionUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [version, payload, signature] = parts;
  void version;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expected, 'base64url');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionUser>;
    if (!/^\d+$/.test(parsed.id ?? '') || !['OPERATOR', 'EXECUTOR', 'FUND'].includes(parsed.role ?? '') || !Number.isInteger(parsed.expiresAt) || (parsed.expiresAt ?? 0) <= Math.floor(Date.now() / 1000)) return null;
    return { id: parsed.id!, role: parsed.role as SessionRole, expiresAt: parsed.expiresAt! };
  } catch {
    return null;
  }
}

export function tokenFromAuthorization(value?: string) {
  return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
}
