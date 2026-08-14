import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const derived = scryptSync(password, salt, 32).toString('base64url');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string) {
  if (!storedHash.startsWith('scrypt$')) {
    // Compatibility for accounts created before the password hardening change.
    return createHash('sha256').update(password, 'utf8').digest('hex') === storedHash;
  }
  const [, salt, expected] = storedHash.split('$');
  if (!salt || !expected) return false;
  const actualBuffer = scryptSync(password, salt, 32);
  const expectedBuffer = Buffer.from(expected, 'base64url');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
