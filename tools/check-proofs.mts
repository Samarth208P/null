import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { buildShieldWitness, buildCreateDistributionWitness, buildClaimWitness, prepareDistributionIntent, authPolicyCommitment, bigintToBytes, toHex, fromHex, secp256k1, profileFromKeys, compileDistribution, scanEnvelopes, finalNoteCommitment, IncrementalMerkleTree } from '../packages/sdk/src/index.ts';
import { proveLocally } from '../packages/prover/src/runtime.ts';
import { proveInWorker } from '../packages/prover/src/index.ts';
import { ProofWorker } from './proof-worker-adapter.mts';
import { createPublicClient, http, parseAbi } from '../apps/web/node_modules/viem/_esm/index.js';
const requireProver = createRequire(new URL('../packages/prover/package.json', import.meta.url));
const { Noir } = requireProver('@noir-lang/noir_js');
const manifest = JSON.parse(await readFile('deployments/11155111.json', 'utf8'));
const context = { chainId: 11155111n, poolAddress: manifest.contracts.nullPool };
// Publicly specified synthetic scalars, for isolated witness/proof tests only. Never funded.
const signer = bigintToBytes(11n), keys = { spendPrivateKey: bigintToBytes(12n), viewPrivateKey: bigintToBytes(13n) };
const policy = { signerPublicKey: toHex(secp256k1.getPublicKey(signer, true)), policyMetadata: 14n, registrationBlinder: 15n };
const shield = buildShieldWitness({ context, amountAtomic: 100n, ownerNullifierKey: 16n, noteSecret: 17n, policyCommitment: authPolicyCommitment(policy) });
const noteTree = new IncrementalMerkleTree(20, [finalNoteCommitment(shield.bodyCommitment, 0)]);
const compiled = await compileDistribution({ context, batchEntropy: new Uint8Array(32).fill(19), recipients: [{ employeeRef: 'Synthetic proof recipient', amountAtomic: 40n, stealthMetaAddress: profileFromKeys(keys).stealthMetaAddress }] });
const options = { compiled, context, treasuryInputs: [{ ownerNullifierKey: 16n, amountAtomic: 100n, noteSecret: 17n, path: noteTree.getPath(0) }], authPolicy: policy, policyPath: new IncrementalMerkleTree(20, [authPolicyCommitment(policy)]).getPath(0), changeOwnerNullifierKey: 20n, changeNoteSecret: 21n, nonce: 22n, validUntil: BigInt(Math.floor(Date.now()/1000)+86400) };
const intent = prepareDistributionIntent(options);
const distribution = buildCreateDistributionWitness({ ...options, signerSignature: toHex(secp256k1.sign(fromHex(intent.digest), signer, { lowS: true, prehash: false }).toCompactRawBytes()) });
const allocations = await scanEnvelopes({ context, keys, envelopes: compiled.envelopes, distributions: [{ ...compiled.publicBundle, confirmed: true, leafIndex: 0 }], source: 'chain' });
assert.equal(allocations.length, 1); assert.equal(allocations[0]!.amountAtomic, 40n);
const claim = buildClaimWitness({ allocation: allocations[0]!, distributionPath: new IncrementalMerkleTree(20, [compiled.commitment]).getPath(0), nonce: 23n, validUntil: options.validUntil });
const server = createServer(async (request, response) => {
  const name = request.url?.slice(1);
  if (!['shield.json','create_distribution.json','claim.json'].includes(name || '')) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type','application/json'); response.end(await readFile(`apps/web/public/circuits/${name}`));
});
await new Promise<void>(accept => server.listen(0,'127.0.0.1',accept));
const port = (server.address() as {port:number}).port;
try {
 for (const [kind,built] of Object.entries({shield,create_distribution:distribution,claim})) {
  if (process.argv.includes('--worker') && kind !== 'shield') continue;
  const artifact = JSON.parse(await readFile(`apps/web/public/circuits/${kind}.json`,'utf8'));
  try { const execution = await new Noir(artifact).execute(built.witness); execution.witness.fill(0); }
  catch { throw new Error(`${kind}: Noir witness constraints failed (private solver output withheld).`); }
  console.log(`PASS ${kind}: genuine Noir witness constraints`);
  if (process.argv.includes('--prove')) {
   const reference={...manifest.build.circuitArtifacts[kind],url:`http://127.0.0.1:${port}/${kind}.json`};
   if (process.argv.includes('--worker')) Object.assign(globalThis,{Worker:ProofWorker});
   const request = {kind:kind as 'shield',artifact:reference,witness:built.witness,expectedPublicInputs:built.publicInputs};
   const onProgress = (stage:string)=>console.log(`${kind}: ${stage}`);
   const result=process.argv.includes('--worker') ? await proveInWorker(request,{onProgress}) : await proveLocally(request,onProgress);
   const rpc=createPublicClient({transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:30000,retryCount:1})});
   const verifier=manifest.contracts[kind==='create_distribution'?'createDistributionVerifier':`${kind}Verifier`];
   assert.equal(await rpc.readContract({address:verifier,abi:parseAbi(['function verify(bytes proof,bytes32[] publicInputs) view returns(bool)']),functionName:'verify',args:[result.proof,result.publicInputs]}),true);
   console.log(`PASS ${kind}: generated proof accepted by deployed Sepolia verifier via eth_call (no transaction)`);
  }
 }
} finally { signer.fill(0); keys.spendPrivateKey.fill(0); keys.viewPrivateKey.fill(0); for(const item of allocations)item.stealthPrivateKey.fill(0); await new Promise<void>(accept=>server.close(()=>accept())); }
