import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function readRootEnv() {
  const envPath = resolve(process.cwd(), '../../.env');
  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

const env = readRootEnv();
const webPort = Number(env.WEB_PORT);
const apiPort = Number(env.API_PORT ?? env.PORT);

if (!webPort) {
  throw new Error('Missing WEB_PORT in .env');
}

if (!apiPort) {
  throw new Error('Missing API_PORT in .env');
}

const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${apiPort}`,
    changeOrigin: true,
  },
};

export default defineConfig({
  resolve: {
    alias: {
      react: resolve(process.cwd(), '../../node_modules/react'),
      'react-dom': resolve(process.cwd(), '../../node_modules/react-dom'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: webPort,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: webPort,
    strictPort: true,
    proxy: apiProxy,
  },
});
