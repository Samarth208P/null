import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, closeSync, constants, existsSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePayroll, type PayrollInput } from './compiler.js';

const sharedEnv = await import(new URL('../../../contracts/scripts/env.mjs', import.meta.url).href) as {
  rootPath: string; readRootEnv: () => Record<string, string>;
};
export const readEnvironment = sharedEnv.readRootEnv;
export const payrollDirectory = resolve(sharedEnv.rootPath, '.artifacts/cre/payroll');
export const maximumPayrollBytes = 65_536;

function privatePermissions(path: string, directory: boolean) {
  if (process.platform !== 'win32') { chmodSync(path, directory ? 0o700 : 0o600); return; }
  const command = '$p = $env:NULL_PRIVATE_STORAGE_PATH; $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User; ' +
    (directory
      ? '$acl = New-Object System.Security.AccessControl.DirectorySecurity; $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"); '
      : '$acl = New-Object System.Security.AccessControl.FileSecurity; $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow"); ') +
    '$acl.SetAccessRuleProtection($true, $false); $acl.AddAccessRule($rule); ' +
    (directory ? '[System.IO.Directory]::SetAccessControl($p, $acl);' : '[System.IO.File]::SetAccessControl($p, $acl);');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    env: { ...process.env, NULL_PRIVATE_STORAGE_PATH: path }, stdio: 'pipe', windowsHide: true,
  });
}

export function preparePrivateStorage() {
  for (const relativePath of ['.artifacts', '.artifacts/cre', '.artifacts/cre/payroll']) {
    const path = resolve(sharedEnv.rootPath, relativePath);
    if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('NULL_PAYROLL_STORAGE_INVALID');
  }
  privatePermissions(payrollDirectory, true);
}

export function readBoundedPayrollFile(path: string): Buffer {
  const original = lstatSync(path);
  if (!original.isFile() || original.isSymbolicLink()) throw new Error('NULL_PAYROLL_FILE_INVALID');
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  let buffer: Buffer | undefined;
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile() || before.size < 1 || before.size > maximumPayrollBytes || before.dev !== original.dev || before.ino !== original.ino)
      throw new Error('NULL_PAYROLL_FILE_INVALID');
    buffer = Buffer.alloc(maximumPayrollBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(descriptor, buffer, length, buffer.length - length, length);
      if (!count) break;
      length += count;
    }
    const after = fstatSync(descriptor);
    if (length !== before.size || length > maximumPayrollBytes || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
      throw new Error('NULL_PAYROLL_FILE_INVALID');
    return Buffer.from(buffer.subarray(0, length));
  } finally { closeSync(descriptor); buffer?.fill(0); }
}

export function validatePayrollBytes(bytes: Uint8Array, batchId?: string): PayrollInput {
  if (bytes.length < 1 || bytes.length > maximumPayrollBytes) throw new Error('NULL_CRE_INPUT_INVALID');
  try { return parsePayroll(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), batchId); }
  catch { throw new Error('NULL_CRE_INPUT_INVALID'); }
}

function batchPath(batchId: string) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(batchId)) throw new Error('NULL_CRE_INPUT_INVALID');
  return resolve(payrollDirectory, `${batchId}.json`);
}

export function storeImmutablePayroll(bytes: Buffer) {
  const payroll = validatePayrollBytes(bytes);
  preparePrivateStorage();
  const destination = batchPath(payroll.batchId);
  const temporary = resolve(payrollDirectory, `.pending-${randomUUID()}`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    // Apply the current-user-only ACL while the file is still empty.
    privatePermissions(temporary, false);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor); descriptor = undefined;
    // An atomic hard link fails if the batch ID exists. Rename could overwrite it.
    linkSync(temporary, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') throw new Error('NULL_PAYROLL_BATCH_ALREADY_EXISTS');
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function readStoredPayroll(batchId: string) {
  const path = batchPath(batchId);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('NULL_PAYROLL_FILE_INVALID');
  privatePermissions(path, false);
  const bytes = readBoundedPayrollFile(path);
  try { validatePayrollBytes(bytes, batchId); return bytes; }
  catch (error) { bytes.fill(0); throw error; }
}
