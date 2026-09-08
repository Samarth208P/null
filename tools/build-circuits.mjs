import { compile_program, createFileManager } from '@noir-lang/noir_wasm';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import '../contracts/scripts/generate-domains.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const restorePaths = [];
// noir_wasm's package loader currently mixes platform separators with Rust WASM
// POSIX paths. Normalize its Node path adapter for this build process only.
// Windows accepts these forward-slash filesystem paths; no installed file is patched.
if (process.platform === 'win32') {
  const nodePath = createRequire(import.meta.url)('node:path');
  for (const method of ['join', 'resolve', 'relative', 'dirname', 'normalize']) {
    const original = nodePath[method];
    restorePaths.push(() => { nodePath[method] = original; });
    nodePath[method] = (...args) => original(...args).replaceAll('\\', '/');
  }
  const originalSeparator = nodePath.sep;
  restorePaths.push(() => { nodePath.sep = originalSeparator; });
  nodePath.sep = '/';
}
const target = resolve(root, 'circuits/target');
mkdirSync(target, { recursive: true });
const kinds = ['shield', 'create_distribution', 'claim', 'withdraw'];
const selected = process.argv.find(arg => arg.startsWith('--kind='))?.slice(7);
if (selected && !kinds.includes(selected)) throw new Error('Unknown circuit kind');
const checksums = selected ? { ...JSON.parse(readFileSync(resolve(target, 'manifest.json'), 'utf8')).circuits } : {};
const withVerifiers = process.argv.includes('--verifiers');
const sha = bytes => '0x' + createHash('sha256').update(bytes).digest('hex');
const manifest = {
  status: withVerifiers ? 'generated' : 'compiled',
  noirVersion: '1.0.0-beta.22', backendVersion: '5.0.0-nightly.20260522',
  verifierTarget: 'evm', tested: false, circuits: checksums,
};
const fileManager = createFileManager(root);
const reuse = process.argv.includes('--reuse');
const previous = reuse ? JSON.parse(readFileSync(resolve(target, 'manifest.json'), 'utf8')) : undefined;
for (const kind of selected ? [selected] : kinds) {
  process.stdout.write(`Compiling ${kind} with pinned Noir (no tests).\n`);
  let program;
  let warnings;
  if (reuse) {
    const cached = readFileSync(resolve(target, `${kind}.json`));
    if (previous.noirVersion !== manifest.noirVersion || sha(cached) !== previous.circuits[kind]?.sha256)
      throw new Error('Cached circuit checksum mismatch; rebuild without --reuse.');
    program = JSON.parse(cached);
    for (const file of Object.values(program.file_map ?? {})) {
      let sourcePath;
      if (file.path.startsWith('null_lib/')) sourcePath = resolve(root, 'circuits/lib/src', file.path.slice(9));
      else if (file.path.startsWith('poseidon/')) sourcePath = resolve(root, 'circuits/vendor/poseidon-0.1.1/src', file.path.slice(9));
      else if (file.path.replaceAll('\\', '/').startsWith(root.replaceAll('\\', '/'))) sourcePath = file.path;
      if (sourcePath && readFileSync(sourcePath, 'utf8') !== file.source)
        throw new Error('Circuit source changed; rebuild without --reuse.');
    }
  } else {
    ({ program, warnings } = await compile_program(fileManager, resolve(root, `circuits/${kind}`)));
  }
  if (!program.bytecode || !program.abi) throw new Error(`Missing compiler output for ${kind}`);
  if (warnings?.length) process.stdout.write(`${warnings.length} compiler warning(s) in ${kind}.\n`);
  const bytes = Buffer.from(JSON.stringify(program));
  writeFileSync(resolve(target, `${kind}.json`), bytes);
  checksums[kind] = { url: `/circuits/${kind}.json`, sha256: sha(bytes), verificationKeySha256: null,
    verifierSourceSha256: null, noirVersion: manifest.noirVersion,
    backendVersion: manifest.backendVersion, verifierTarget: 'evm' };
}
restorePaths.forEach(restore => restore());
// Persist successful compilation before optional verifier generation. A backend
// environment failure must not erase the usable compiled artifacts.
writeFileSync(resolve(target, 'manifest.json'), JSON.stringify({ ...manifest, status: 'compiled' }, null, 2) + '\n');
if (withVerifiers) {
  // Resolve the runtime from its owning package; no native/global bb installation required.
  const requireProver = createRequire(resolve(root, 'packages/prover/package.json'));
  const { Barretenberg, BackendType, UltraHonkBackend } = await import(pathToFileURL(requireProver.resolve('@aztec/bb.js')).href);
  const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1,
    crsPath: resolve(target, 'crs'), logger: () => {} });
  try {
    for (const kind of selected ? [selected] : kinds) {
      process.stdout.write(`Generating ZK-enabled EVM verifier for ${kind}.\n`);
      const circuit = JSON.parse(readFileSync(resolve(target, `${kind}.json`), 'utf8'));
      const backend = new UltraHonkBackend(circuit.bytecode, api);
      const options = { verifierTarget: 'evm' };
      const vk = await backend.getVerificationKey(options);
      const originalSource = await backend.getSolidityVerifier(vk, options);
      const name = kind === 'shield' ? 'ShieldVerifier' : kind === 'claim' ? 'ClaimVerifier' : kind === 'withdraw' ? 'WithdrawVerifier' : 'CreateDistributionVerifier';
      if (!/contract HonkVerifier\b/.test(originalSource)) throw new Error('Unexpected generated verifier source');
      const source = originalSource.replace(/contract HonkVerifier\b/, `contract ${name}`);
      writeFileSync(resolve(target, `${kind}.vk`), vk);
      mkdirSync(resolve(root, 'contracts/src/generated'), { recursive: true });
      writeFileSync(resolve(root, `contracts/src/generated/${name}.sol`), source);
      checksums[kind].verificationKeySha256 = sha(vk);
      checksums[kind].verifierSourceSha256 = sha(source);
    }
  } finally { await api.destroy(); }
}
writeFileSync(resolve(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(`Circuit build ${manifest.status}. Artifact integrity is recorded; no proof or contract tests ran.\n`);
