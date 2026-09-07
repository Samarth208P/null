import { gcm } from '@noble/ciphers/aes';
import { compileDistribution, parsePrivacyProfile } from '@null-protocol/sdk';

export interface PayrollInput {
  batchId: string;
  batchEntropyHex: string;
  recipients: { employeeRef: string; amountAtomic: string; stealthMetaAddress: string }[];
}
export interface CompilerContext { chainId: string; poolAddress: `0x${string}` }
export interface ExpectedCompilation { commitment: string; envelopeRoot: string }
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('NULL_CRE_INPUT_INVALID');
}
export function parsePayroll(value: unknown, batchId?: string): PayrollInput {
  object(value);
  if (Object.keys(value).sort().some(key => !['batchId', 'batchEntropyHex', 'recipients'].includes(key)) || typeof value.batchId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.batchId) || (batchId && value.batchId !== batchId) || typeof value.batchEntropyHex !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value.batchEntropyHex) || /^0x0+$/.test(value.batchEntropyHex)) throw new Error('NULL_CRE_INPUT_INVALID');
  if (!Array.isArray(value.recipients) || value.recipients.length < 1 || value.recipients.length > 8) throw new Error('NULL_CRE_INPUT_INVALID');
  const names = new Set<string>();
  for (const recipient of value.recipients) {
    object(recipient);
    if (Object.keys(recipient).sort().some(key => !['employeeRef', 'amountAtomic', 'stealthMetaAddress'].includes(key)) || typeof recipient.employeeRef !== 'string' || recipient.employeeRef.length < 1 || recipient.employeeRef.length > 128 || names.has(recipient.employeeRef) || typeof recipient.amountAtomic !== 'string' || !/^[1-9][0-9]{0,19}$/.test(recipient.amountAtomic) || BigInt(recipient.amountAtomic) > 18_446_744_073_709_551_615n || typeof recipient.stealthMetaAddress !== 'string') throw new Error('NULL_CRE_INPUT_INVALID');
    const canonicalRef = recipient.employeeRef.normalize('NFKC').trim();
    const uniqueRef = canonicalRef.toLocaleLowerCase('en-US');
    if (!canonicalRef || new TextEncoder().encode(canonicalRef).length > 200 || /[\u0000-\u001f\u007f]/u.test(canonicalRef) || names.has(uniqueRef)) throw new Error('NULL_CRE_INPUT_INVALID');
    try { parsePrivacyProfile(recipient.stealthMetaAddress); }
    catch { throw new Error('NULL_CRE_INPUT_INVALID'); }
    names.add(uniqueRef);
  }
  return value as unknown as PayrollInput;
}
/** Same deterministic kernel runs locally and inside TEE. Only ciphertext/public roots leave. */
export async function compilePayroll(input: PayrollInput, context: CompilerContext, expected?: ExpectedCompilation) {
  const entropy = Uint8Array.from(input.batchEntropyHex.slice(2).match(/../g)!, byte => parseInt(byte, 16));
  try {
    const compiled = await compileDistribution({
      recipients: input.recipients.map(recipient => ({ ...recipient, amountAtomic: BigInt(recipient.amountAtomic) })),
      context: { chainId: BigInt(context.chainId), poolAddress: context.poolAddress },
      batchEntropy: entropy,
      encryptionProvider: async (key, nonce, plaintext, aad) => gcm(key, nonce, aad).encrypt(plaintext),
    });
    if (expected && (compiled.commitment.toLowerCase() !== expected.commitment.toLowerCase() || compiled.envelopeRoot.toLowerCase() !== expected.envelopeRoot.toLowerCase())) throw new Error('NULL_CRE_COMPILE_MISMATCH');
    if (compiled.publicBundle.envelopes.length !== 8 || compiled.publicBundle.envelopes.some(envelope => envelope.ciphertext.length !== 1_082)) throw new Error('NULL_CRE_COMPILE_MISMATCH');
    return compiled.publicBundle;
  } catch (error) {
    if (error instanceof Error && error.message === 'NULL_CRE_COMPILE_MISMATCH') throw error;
    throw new Error('NULL_CRE_COMPILE_FAILED');
  } finally { entropy.fill(0); }
}
