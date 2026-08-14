import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function uploadRoot() {
  return resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

export function ensureUploadRoot() {
  const root = uploadRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

export function uploadPublicUrl(relativePath: string) {
  return `/api/v1/upload-files/${relativePath.replace(/\\/g, '/')}`;
}
