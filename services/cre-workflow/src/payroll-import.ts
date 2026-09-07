import { resolve } from 'node:path';
import { readBoundedPayrollFile, storeImmutablePayroll } from './payroll-storage.js';

let bytes: Buffer | undefined;
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--input' || !args[1]) throw new Error('NULL_PAYROLL_IMPORT_ARGUMENTS_REQUIRED');
  bytes = readBoundedPayrollFile(resolve(args[1]));
  storeImmutablePayroll(bytes);
  process.stdout.write('Payroll batch imported into private local storage. Existing batches cannot be overwritten.\n');
} catch (error) {
  const code = error instanceof Error && /^NULL_[A-Z_]+$/.test(error.message) ? error.message : 'NULL_PAYROLL_IMPORT_FAILED';
  process.stderr.write(code + '\n');
  process.exitCode = 1;
} finally { bytes?.fill(0); }
