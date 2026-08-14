import { createCipheriv, createHash, randomBytes } from 'node:crypto';

function getEncryptionKey() {
  // Prefer a dedicated key in deployment. DATABASE_URL keeps local development
  // usable when the dedicated environment variable has not been added yet.
  const source = process.env.EXECUTOR_ACCOUNT_ENCRYPTION_KEY ?? process.env.DATABASE_URL ?? 'xlyq-fund-relay-local-secret';
  return createHash('sha256').update(source, 'utf8').digest();
}

export function encryptAccountPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}
