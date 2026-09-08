import { parentPort } from 'node:worker_threads';
import { proveLocally } from '../packages/prover/src/runtime.ts';
parentPort!.on('message', async ({id,request}) => {
  try { const result = await proveLocally(request, stage => parentPort!.postMessage({id,stage})); parentPort!.postMessage({id,result}); }
  catch { parentPort!.postMessage({id,error:'NULL_PROOF_FAILED'}); }
});
