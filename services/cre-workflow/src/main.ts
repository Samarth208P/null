import { HTTPCapability, HTTPClient, Runner, handlerInTee, type HTTPPayload, type TeeRuntime } from '@chainlink/cre-sdk';
import { compilePayroll, parsePayroll, type CompilerContext } from './compiler.js';

interface Config extends CompilerContext { payrollBaseUrl: string; payrollSecretId: string; authorizedPublicKey: string }
function parseConfig(bytes: Uint8Array): Config {
  const config = JSON.parse(new TextDecoder().decode(bytes)) as Config;
  const url = new URL(config.payrollBaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^0x[0-9a-fA-F]{40}$/.test(config.poolAddress) || BigInt(config.poolAddress) === 0n || !/^[1-9][0-9]*$/.test(config.chainId) || !config.payrollSecretId || !/^0x[0-9a-fA-F]{40}$/.test(config.authorizedPublicKey) || BigInt(config.authorizedPublicKey) === 0n) throw new Error('NULL_CRE_CONFIG_REQUIRED');
  return config;
}
async function confidentialCompile(runtime: TeeRuntime<Config>, payload: HTTPPayload) {
  // The trigger contains only a public batch reference and expected roots, never payroll rows.
  if (payload.input.length > 2_048) throw new Error('NULL_CRE_INPUT_INVALID');
  let request: { batchId: string; expectedCommitment: string; expectedEnvelopeRoot: string };
  try {
    request = JSON.parse(new TextDecoder().decode(payload.input));
    if (Object.keys(request).sort().some(key => !['batchId', 'expectedCommitment', 'expectedEnvelopeRoot'].includes(key)) || !/^[a-zA-Z0-9_-]{1,80}$/.test(request.batchId) || !/^0x[0-9a-fA-F]{64}$/.test(request.expectedCommitment) || !/^0x[0-9a-fA-F]{64}$/.test(request.expectedEnvelopeRoot)) throw new Error();
  } catch { throw new Error('NULL_CRE_INPUT_INVALID'); }
  try {
    const credential = runtime.getSecret({ id: runtime.config.payrollSecretId }).result();
    const client = new HTTPClient();
    // Passing TeeRuntime keeps the capability request and secret inside the handler's TEE.
    // Never use runtime.usingTheDons() for this request or compiler work.
    const response = client.sendRequest(runtime, { url: `${runtime.config.payrollBaseUrl.replace(/\/$/, '')}/${request.batchId}`, method: 'GET', multiHeaders: { Authorization: { values: [`Bearer ${credential.value}`] } }, cacheSettings: { store: false, maxAge: '0s' }, timeout: '15s' }).result();
    if (response.statusCode !== 200 || response.body.length > 65_536) throw new Error('NULL_CRE_FETCH_FAILED');
    const payroll = parsePayroll(JSON.parse(new TextDecoder().decode(response.body)), request.batchId);
    const publicBundle = await compilePayroll(payroll, runtime.config, { commitment: request.expectedCommitment, envelopeRoot: request.expectedEnvelopeRoot });
    // Explicitly return only the ciphertext bundle. No rows, counts, salaries or entropy.
    return { mode: 'cre-tee', publicBundle };
  } catch (error) {
    if (error instanceof Error && error.message === 'NULL_CRE_COMPILE_MISMATCH') throw error;
    throw new Error('NULL_CRE_COMPILE_FAILED');
  }
}
export async function main() {
  const runner = await Runner.newRunner<Config>({ configParser: parseConfig });
  await runner.run(config => [handlerInTee(new HTTPCapability().trigger({ authorizedKeys: [{ type: 'KEY_TYPE_ECDSA_EVM', publicKey: config.authorizedPublicKey }] }), confidentialCompile, [{ tee: 'nitro', regions: ['us-west-2'] }])]);
}
await main();
