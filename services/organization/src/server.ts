import type { IncomingMessage, ServerResponse } from 'node:http';
import { memoryIntents, type IntentStore, type StoredIntent } from './intents.js';
import { randomUUID } from 'node:crypto';
import { PrivyClient } from '@privy-io/node';
import { createPrivyOrganizationAuthorizer, type PrivyOrganizationConfig } from '@null-protocol/auth/server';
import { validatePaymentIntent, type CompiledIntentContext } from '@null-protocol/auth';
import type { Hex } from 'viem';

class OrganizationError extends Error { constructor(public code: string, public status = 400) { super(code); } }
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new OrganizationError('NULL_REQUEST_REJECTED');
}
function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new OrganizationError('NULL_ORGANIZATION_CONFIG_REQUIRED', 503); return value; }
function list(name: string) { return required(name).split(',').map(value => value.trim()).filter(Boolean); }
function address(value: string): Hex { if (!/^0x[0-9a-fA-F]{40}$/.test(value) || BigInt(value) === 0n) throw new OrganizationError('NULL_ORGANIZATION_CONFIG_REQUIRED', 503); return value as Hex; }
const origins = new Set((process.env.ORGANIZATION_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean));
let config: PrivyOrganizationConfig | undefined;
let privy: PrivyClient | undefined;
let authorizer: ReturnType<typeof createPrivyOrganizationAuthorizer> | undefined;
const members = new Set<string>();
try {
  for (const member of list('PRIVY_ORGANIZATION_MEMBER_IDS')) {
    if (!/^did:privy:[a-zA-Z0-9]+$/.test(member)) throw new OrganizationError('NULL_ORGANIZATION_CONFIG_REQUIRED', 503);
    members.add(member);
  }
  config = {
    appId: required('PRIVY_APP_ID'), appSecret: required('PRIVY_APP_SECRET'), walletId: required('PRIVY_ORGANIZATION_WALLET_ID'), walletAddress: address(required('PRIVY_ORGANIZATION_WALLET_ADDRESS')),
    ownerQuorumId: required('PRIVY_ORGANIZATION_OWNER_QUORUM_ID'), organizationEntityId: required('PRIVY_ORGANIZATION_ENTITY_ID'), requiredPolicyIds: process.env.PRIVY_ORGANIZATION_CONTROL_MODE === 'owner-quorum' ? [] : list('PRIVY_ORGANIZATION_POLICY_IDS'),
    controlMode: process.env.PRIVY_ORGANIZATION_CONTROL_MODE === 'owner-quorum' ? 'owner-quorum' : 'policies-and-quorum', expectedOwnerUserIds: [...members],
    minimumApprovals: Number(required('PRIVY_ORGANIZATION_MINIMUM_APPROVALS')), chainId: BigInt(required('NULL_CHAIN_ID')), poolAddress: address(required('NULL_POOL_ADDRESS')),
  };
  if (config.chainId !== 11155111n) throw new OrganizationError('NULL_CONTEXT_MISMATCH', 503);
  privy = new PrivyClient({ appId: config.appId, appSecret: config.appSecret, logLevel: 'off', timeout: 15_000, maxRetries: 1 });
  authorizer = createPrivyOrganizationAuthorizer(config);
} catch { config = undefined; privy = undefined; authorizer = undefined; }

interface PendingIntent extends StoredIntent { publicInputs: Hex[]; expected: CompiledIntentContext }
let intents: IntentStore = memoryIntents();
export function useIntentStore(store: IntentStore) { intents = store; }
const limits = new Map<string, { count: number; reset: number }>();
function admit(key: string, maximum: number) {
  const now = Date.now();
  if (limits.size > 10_000) for (const [id, value] of limits) if (value.reset <= now) limits.delete(id);
  if (limits.size >= 20_000 && !limits.has(key)) return false;
  const current = limits.get(key);
  if (!current || current.reset <= now) { limits.set(key, { count: 1, reset: now + 60_000 }); return true; }
  return ++current.count <= maximum;
}
function parseIntent(value: unknown) {
  exact(value, ['publicInputs', 'expected']);
  const candidate = value.expected as Record<string,unknown> | undefined;
  const withdrawal = candidate?.kind === 'withdrawal';
  exact(candidate, withdrawal ? ['kind','chainId','poolAddress','recipient','amountAtomic'] : ['chainId','poolAddress','commitment','envelopeRoot']);
  if (!Array.isArray(value.publicInputs) || value.publicInputs.length !== (withdrawal ? 10 : 15) || value.publicInputs.some(input => typeof input !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(input)) || typeof candidate.chainId !== 'string' || !/^[1-9][0-9]*$/.test(candidate.chainId) || typeof candidate.poolAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(candidate.poolAddress)) throw new OrganizationError('NULL_REQUEST_REJECTED');
  let context: CompiledIntentContext;
  const base = {chainId:BigInt(candidate.chainId),poolAddress:candidate.poolAddress as Hex};
  if (withdrawal) {
    if (typeof candidate.recipient !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(candidate.recipient) || typeof candidate.amountAtomic !== 'string' || !/^[1-9][0-9]{0,19}$/.test(candidate.amountAtomic)) throw new OrganizationError('NULL_REQUEST_REJECTED');
    context = {...base,kind:'withdrawal',recipient:candidate.recipient as Hex,amountAtomic:BigInt(candidate.amountAtomic)};
  } else {
    if (typeof candidate.commitment !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(candidate.commitment) || typeof candidate.envelopeRoot !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(candidate.envelopeRoot)) throw new OrganizationError('NULL_REQUEST_REJECTED');
    context = {...base,commitment:candidate.commitment as Hex,envelopeRoot:candidate.envelopeRoot as Hex};
  }
  if (!config || context.chainId !== config.chainId || context.poolAddress.toLowerCase() !== config.poolAddress.toLowerCase()) throw new OrganizationError('NULL_CONTEXT_MISMATCH');
  const publicInputs = value.publicInputs as Hex[]; validatePaymentIntent(publicInputs,context);
  return {publicInputs,expected:context};
}

const safeErrors: Record<string, number> = {
  NULL_PRIVY_AUTH_FAILED: 403, NULL_PRIVY_CONTROL_MISMATCH: 409, NULL_PRIVY_APPROVALS_REQUIRED: 409,
  NULL_CONTEXT_MISMATCH: 409, NULL_CRE_COMPILE_MISMATCH: 409, NULL_INTENT_EXPIRED: 409,
};
export async function organizationHandler(request: IncomingMessage, response: ServerResponse) {
  let stage = 'session';
  response.setHeader('content-type', 'application/json'); response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff'); response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-request-id', randomUUID());
  const reply = (status: number, body: unknown) => { response.writeHead(status); response.end(JSON.stringify(body)); };
  const origin = request.headers.origin;
  if (origin) {
    if (!origins.has(origin)) { reply(403, { code: 'NULL_ORIGIN_REJECTED' }); request.resume(); return; }
    response.setHeader('access-control-allow-origin', origin); response.setHeader('vary', 'Origin');
  }
  if (request.method === 'OPTIONS') { response.setHeader('access-control-allow-methods', 'POST, GET'); response.setHeader('access-control-allow-headers', 'authorization, content-type'); response.writeHead(204); response.end(); return; }
  if (request.method === 'GET' && request.url === '/health') { reply(authorizer ? 200 : 503, { status: authorizer ? 'configured' : 'unavailable', approvalExecution: 'not-tracked' }); return; }
  if (!['/api/organization/config', '/api/organization/prepare', '/api/organization/authorize', '/api/organization/prepare-identity', '/api/organization/identify'].includes(request.url ?? '') || !((request.url === '/api/organization/config' && request.method === 'GET') || (request.url !== '/api/organization/config' && request.method === 'POST'))) { reply(404, { code: 'NULL_NOT_FOUND' }); request.resume(); return; }
  try {
    if (!config || !privy || !authorizer) throw new OrganizationError('NULL_ORGANIZATION_CONFIG_REQUIRED', 503);
    if (!admit(`ip:${request.socket.remoteAddress ?? 'unknown'}`, 30)) throw new OrganizationError('NULL_RATE_LIMITED', 429);
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 8_192) throw new OrganizationError('NULL_SESSION_REQUIRED', 401);
    let session;
    try { session = await privy.utils().auth().verifyAccessToken(authorization.slice(7)); } catch { throw new OrganizationError('NULL_SESSION_INVALID', 401); }
    // Trust only the verified app token and server-configured membership, never a body organization/user ID.
    if (session.app_id !== config.appId || session.issuer !== 'privy.io' || !session.user_id || !session.session_id || !members.has(session.user_id)) throw new OrganizationError('NULL_ORGANIZATION_FORBIDDEN', 403);
    if (!admit(`user:${session.user_id}`, 20)) throw new OrganizationError('NULL_RATE_LIMITED', 429);
    if (request.url === '/api/organization/config') {
      const wallet = await authorizer.verifyWalletControl();
      reply(200, { chainId: config.chainId.toString(), poolAddress: config.poolAddress, walletAddress: config.walletAddress, minimumApprovals: config.minimumApprovals, ownerQuorumId: wallet.owner_id, signerPublicKey: wallet.public_key ?? null }); return;
    }
    if (!request.headers['content-type']?.startsWith('application/json')) throw new OrganizationError('NULL_CONTENT_TYPE', 415);
    if (Number(request.headers['content-length'] ?? 0) > 32_768) throw new OrganizationError('NULL_PAYLOAD_TOO_LARGE', 413);
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 32_768) throw new OrganizationError('NULL_PAYLOAD_TOO_LARGE', 413); chunks.push(Buffer.from(chunk)); }
    let body: unknown; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new OrganizationError('NULL_REQUEST_REJECTED'); }
    if (request.url === '/api/organization/prepare-identity') {
      exact(body, []);
      if (config.minimumApprovals !== 1) throw new OrganizationError('NULL_PRIVY_APPROVALS_REQUIRED', 409);
      stage = 'prepare-identity';
      const authorizationRequest = await authorizer.prepareIdentity();
      const ticket = randomUUID();
      stage = 'save-identity-intent';
      await intents.put(`identity/${ticket}`, { userId: session.user_id, sessionId: session.session_id, expiresAt: Number(authorizationRequest.headers['privy-request-expiry']) });
      reply(200, { ticket, authorizationRequest, walletAddress: config.walletAddress, minimumApprovals: config.minimumApprovals }); return;
    }
    if (request.url === '/api/organization/identify') {
      exact(body, ['ticket', 'signatures']);
      if (typeof body.ticket !== 'string' || !Array.isArray(body.signatures) || body.signatures.length !== 1 || body.signatures.some(value => typeof value !== 'string')) throw new OrganizationError('NULL_REQUEST_REJECTED');
      if (!/^[a-f0-9-]{36}$/.test(body.ticket)) throw new OrganizationError('NULL_REQUEST_REJECTED');
      const prepared = await intents.get(`identity/${body.ticket}`);
      if (!prepared || prepared.expiresAt <= Date.now()) throw new OrganizationError('NULL_INTENT_EXPIRED', 409);
      if (prepared.userId !== session.user_id || prepared.sessionId !== session.session_id) throw new OrganizationError('NULL_ORGANIZATION_FORBIDDEN', 403);
      if (!await intents.consume(`identity/${body.ticket}`)) throw new OrganizationError('NULL_INTENT_EXPIRED', 409);
      stage = 'sign-identity';
      const result = await authorizer.identify(prepared.expiresAt, body.signatures as string[]);
      reply(200, { digest: result.digest, signer: result.signer, publicKey: result.publicKey }); return;
    }
    if (request.url === '/api/organization/prepare') {
      const intent = parseIntent(body);
      const authorizationRequest = await authorizer.prepare(intent.publicInputs, intent.expected);
      const ticket = randomUUID();
      const expiresAt = Number(authorizationRequest.headers['privy-request-expiry']);
      await intents.put(`distribution/${ticket}`, { ...intent, userId: session.user_id, sessionId: session.session_id, expiresAt });
      reply(200, { ticket, authorizationRequest, walletAddress: config.walletAddress, minimumApprovals: config.minimumApprovals }); return;
    }
    exact(body, ['ticket', 'signatures']);
    if (typeof body.ticket !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.ticket) || !Array.isArray(body.signatures) || body.signatures.length < config.minimumApprovals || body.signatures.length > 20 || body.signatures.some(value => typeof value !== 'string')) throw new OrganizationError('NULL_REQUEST_REJECTED');
    const prepared = await intents.get(`distribution/${body.ticket}`) as PendingIntent | undefined;
    if (!prepared || prepared.expiresAt <= Date.now()) throw new OrganizationError('NULL_INTENT_EXPIRED', 409);
    if (prepared.userId !== session.user_id || prepared.sessionId !== session.session_id) throw new OrganizationError('NULL_ORGANIZATION_FORBIDDEN', 403);
    // Consume before signing so concurrent requests cannot repurpose or duplicate a prepared approval.
    if (!await intents.consume(`distribution/${body.ticket}`)) throw new OrganizationError('NULL_INTENT_EXPIRED', 409);
    const result = await authorizer.authorize({ publicInputs: prepared.publicInputs, expected: prepared.expected, requestExpiryMs: prepared.expiresAt, signatures: body.signatures as string[] });
    reply(200, result);
  } catch (error) {
    // Operational diagnostics contain no tokens, signatures, IDs, or request bodies.
    const diagnosticCode = error instanceof OrganizationError ? error.code : error instanceof Error && /^NULL_[A-Z_]+$/.test(error.message) ? error.message : 'NULL_ORGANIZATION_UNAVAILABLE';
    const errorType = error instanceof Error && /^[a-zA-Z]{1,64}$/.test(error.name) ? error.name : 'Error';
    console.warn(JSON.stringify({ event: 'null_organization_request_failed', stage, code: diagnosticCode, errorType }));
    if (error instanceof OrganizationError) { if (error.status === 429) response.setHeader('retry-after', '60'); reply(error.status, { code: error.code }); }
    else if (error instanceof Error && safeErrors[error.message]) reply(safeErrors[error.message], { code: error.message });
    else reply(503, { code: 'NULL_ORGANIZATION_UNAVAILABLE' });
    request.resume();
  }
}
