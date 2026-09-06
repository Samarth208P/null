import { readFile, writeFile } from 'node:fs/promises';
import { compilePayroll, parsePayroll, type CompilerContext } from './compiler.js';

const args = process.argv.slice(2);
function argument(name: string) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
try {
  const inputPath = argument('--input'); const contextPath = argument('--context'); const outputPath = argument('--output');
  if (!inputPath || !contextPath || !outputPath) throw new Error('NULL_LOCAL_COMPILER_ARGUMENTS_REQUIRED');
  const inputText = await readFile(inputPath, 'utf8');
  if (inputText.length > 65_536) throw new Error('NULL_CRE_INPUT_INVALID');
  const input = parsePayroll(JSON.parse(inputText));
  const context = JSON.parse(await readFile(contextPath, 'utf8')) as CompilerContext;
  const publicBundle = await compilePayroll(input, context);
  await writeFile(outputPath, JSON.stringify({ mode: 'local-fallback', confidentialExecution: false, publicBundle }, null, 2), { flag: 'wx', mode: 0o600 });
  process.stdout.write('Public bundle written. Local compilation is not a CRE execution.\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error && /^NULL_[A-Z_]+$/.test(error.message) ? error.message : 'NULL_LOCAL_COMPILE_FAILED'}\n`);
  process.exitCode = 1;
}
