import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readRootEnv() {
  const envPath = resolve(process.cwd(), '../../.env');
  const env = {};
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
const required = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error(`Missing .env keys: ${missing.join(', ')}`);
  process.exit(1);
}

const user = encodeURIComponent(env.MYSQL_USER);
const password = encodeURIComponent(env.MYSQL_PASSWORD);
const host = env.MYSQL_HOST;
const port = env.MYSQL_PORT;
const database = env.MYSQL_DATABASE;
const databaseUrl = `mysql://${user}:${password}@${host}:${port}/${database}`;

let [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/with-database-url.mjs <command> [...args]');
  process.exit(1);
}

if (command === 'nest') {
  command = process.execPath;
  args = [resolve(process.cwd(), 'node_modules/@nestjs/cli/bin/nest.js'), ...args];
}

if (command === 'prisma') {
  command = process.execPath;
  args = [resolve(process.cwd(), 'node_modules/prisma/build/index.js'), ...args];
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...env,
    DATABASE_URL: databaseUrl,
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
