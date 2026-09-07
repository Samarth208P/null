import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export const rootPath = fileURLToPath(new URL('../../', import.meta.url));
export const envPath = resolve(rootPath, '.env');

export function readRootEnv() {
  if (!existsSync(envPath)) return {};
  if (!lstatSync(envPath).isFile()) throw new Error('Root .env must be a regular file.');
  return parseEnv(readFileSync(envPath, 'utf8'));
}

export function loadRootEnv() {
  const values = readRootEnv();
  for (const [name, value] of Object.entries(values)) if (process.env[name] === undefined) process.env[name] = value;
  return values;
}

function protectFile(path) {
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$p = $env:NULL_ENV_FILE; $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User; ' +
      '$acl = [System.IO.File]::GetAccessControl($p); $acl.SetAccessRuleProtection($true, $false); ' +
      'foreach ($existing in $acl.Access) { $acl.RemoveAccessRuleAll($existing); } ' +
      '$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow"); ' +
      '$acl.AddAccessRule($rule); [System.IO.File]::SetAccessControl($p, $acl);',
    ], { env: { ...process.env, NULL_ENV_FILE: path }, stdio: 'pipe' });
  } else chmodSync(path, 0o600);
}

function encodeValue(name, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof value !== 'string' || value.includes('\0'))
    throw new Error('Invalid environment entry; configuration was not written.');
  for (const encoded of [value, `'${value}'`, `"${value}"`, '`' + value + '`']) {
    const parsed = parseEnv(`${name}=${encoded}\n`);
    if (Object.keys(parsed).length === 1 && parsed[name] === value) return encoded;
  }
  throw new Error(`Environment value for ${name} cannot be preserved safely.`);
}

// Merge only the supplied updates. The temporary file is protected before writing.
export function updateRootEnv(updates) {
  execFileSync('git', ['check-ignore', '--quiet', '--no-index', '.env'], { cwd: rootPath });
  const existing = readRootEnv();
  if (Object.entries(updates).every(([name, value]) => Object.hasOwn(existing, name) && existing[name] === value)) return;
  const values = { ...existing, ...updates };
  const body = '# Private local configuration. Never commit or serve this file. Only VITE_ values are public.\n' +
    Object.entries(values).map(([name, value]) => `${name}=${encodeValue(name, value)}`).join('\n') + '\n';
  const parsed = parseEnv(body);
  if (Object.keys(values).length !== Object.keys(parsed).length || Object.entries(values).some(([name, value]) => parsed[name] !== value))
    throw new Error('Environment round-trip verification failed; configuration was not written.');
  const temporary = resolve(rootPath, `.env.write-${process.pid}-${Date.now()}`);
  let descriptor;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    protectFile(temporary);
    writeFileSync(descriptor, body);
    fsyncSync(descriptor);
    closeSync(descriptor); descriptor = undefined;
    renameSync(temporary, envPath);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
