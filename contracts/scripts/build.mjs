import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
}
const sources = Object.fromEntries(files(resolve(root, 'contracts/src')).filter(p => p.endsWith('.sol'))
  .map(path => [relative(resolve(root, 'contracts'), path).replaceAll('\\', '/'), { content: readFileSync(path, 'utf8') }]));
const compiled = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity', sources,
  settings: {
    optimizer: { enabled: true, runs: 200 }, viaIR: false, evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] } },
  },
})));
for (const error of compiled.errors ?? []) process.stderr.write(error.formattedMessage + '\n');
if ((compiled.errors ?? []).some(error => error.severity === 'error')) process.exit(1);
mkdirSync(resolve(root, 'contracts/artifacts'), { recursive: true });
mkdirSync(resolve(root, 'contracts/abi'), { recursive: true });
const exported = [];
const integrity = { compilerVersion: solc.version(), sources: {}, artifacts: {} };
const sha = bytes => '0x' + createHash('sha256').update(bytes).digest('hex');
for (const [path, source] of Object.entries(sources)) integrity.sources[path] = sha(source.content);
for (const [source, contracts] of Object.entries(compiled.contracts)) {
  for (const [name, contract] of Object.entries(contracts)) {
    const artifact = { contractName: name, sourceName: source, compilerVersion: solc.version(),
      abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`,
      deployedBytecode: `0x${contract.evm.deployedBytecode.object}` };
    const artifactBytes = JSON.stringify(artifact, null, 2) + '\n';
    writeFileSync(resolve(root, `contracts/artifacts/${name}.json`), artifactBytes);
    integrity.artifacts[name] = sha(artifactBytes);
    if (['NullPool', 'NullAuthRegistry', 'IERC20', 'IVerifier'].includes(name) && !source.startsWith('src/generated/')) {
      writeFileSync(resolve(root, `contracts/abi/${name}.json`), JSON.stringify(contract.abi, null, 2) + '\n');
      const variable = name === 'IERC20' ? 'erc20Abi' : name === 'IVerifier' ? 'verifierAbi' : name[0].toLowerCase() + name.slice(1) + 'Abi';
      exported.push(`export const ${variable} = ${JSON.stringify(contract.abi, null, 2)} as const;`);
    }
  }
}
writeFileSync(resolve(root, 'packages/contracts/src/index.ts'),
  '// Generated from Solidity source by contracts/scripts/build.mjs. Do not edit.\n' + exported.join('\n\n') + '\n');
writeFileSync(resolve(root, 'contracts/artifacts/build-integrity.json'), JSON.stringify(integrity, null, 2) + '\n');
process.stdout.write('Solidity source compiled; ABI bindings and bytecode generated. No tests executed.\n');
