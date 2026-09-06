import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { PrivyClient } from '@privy-io/node';
import { createPrivyOrganizationAuthorizer, type PrivyOrganizationConfig } from '@null-protocol/auth/server';
import { validateDistributionIntent, type CompiledIntentContext } from '@null-protocol/auth';
import type { Hex } from 'viem';

class OrganizationError extends Error { constructor(public code: string, public status = 400) { super(code); } }
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new OrganizationError('NULL_REQUEST_REJECTED');
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
    ownerQuorumId: required('PRIVY_ORGANIZATION_OWNER_QUORUM_ID'), organizationEntityId: required('PRIVY_ORGANIZATION_ENTITY_ID'), requiredPolicyIds: list('PRIVY_ORGANIZATION_POLICY_IDS'),
    minimumApprovals: Number(required('PRIVY_ORGANIZATION_MINIMUM_APPROVALS')), chainId: BigInt(required('NULL_CHAIN_ID')), poolAddress: address(required('NULL_POOL_ADDRESS')),
  };
  if (config.chainId !== 11155111n) throw new OrganizationError('NULL_CONTEXT_MISMATCH', 503);
  privy = new PrivyClient({ appId: config.appId, appSecret: config.appSecret, logLevel: 'off', timeout: 15_000, maxRetries: 1 });
  authorizer = createPrivyOrganizationAuthorizer(config);
} catch { config = undefined; privy = undefined; authorizer = undefined; }

interface PendingIntent { userId: string; sessionId: string; publicInputs: Hex[]; expected: CompiledIntentContext; expiresAt: number }
const intents = new Map<string, PendingIntent>();
const limits = new Map<string, { count: number; reset: number }>();
function admit(key: string, maximum: number) {
  const now = Date.now();
  if (limits.size > 10_000) for (const [id, value] of limits) if (value.reset <= now) limits.delete(id);
  if (limits.size >= 20_000 && !limits.has(key)) return false;
  const current = limits.get(key);
  if (!current || current.reset <= now) { limits.set(key, { count: 1, reset: now + 60_000 }); return true; }
  return ++current.count <= maximum;
}
function clearExpired() { for (const [ticket, intent] of intents) if (intent.expiresAt <= Date.now()) intents.delete(ticket); }
function parseIntent(value: unknown) {
  exact(value, ['publicInputs', 'expected']);
  exact(value.expected, ['chainId', 'poolAddress', 'commitment', 'envelopeRoot']);
  const expected = value.expected;
  if (!Array.isArray(value.publicInputs) || value.publicInputs.length !== 15 || value.publicInputs.some(input => typeof input !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(input)) || typeof expected.chainId !== 'string' || !/^[1-9][0-9]*$/.test(expected.chainId) || typeof expected.poolAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(expected.poolAddress) || typeof expected.commitment !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(expected.commitment) || typeof expected.envelopeRoot !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(expected.envelopeRoot)) throw new OrganizationError('NULL_REQUEST_REJECTED');
  const publicInputs = value.publicInputs as Hex[];
  const context: CompiledIntentContext = { chainId: BigInt(expected.chainId), poolAddress: expected.poolAddress as Hex, commitment: expected.commitment as Hex, envelopeRoot: expected.envelopeRoot as Hex };
  if (!config || context.chainId !== config.chainId || context.poolAddress.toLowerCase() !== config.poolAddress.toLowerCase()) throw new OrganizationError('NULL_CONTEXT_MISMATCH');
  validateDistributionIntent(publicInputs, context);
  return { publicInputs, expected: context };
}
const safeErrors: Record<string, number> = {
  NULL_PRIVY_AUTH_FAILED: 403, NULL_PRIVY_CONTROL_MISMATCH: 409, NULL_PRIVY_APPROVALS_REQUIRED: 409,
  NULL_CONTEXT_MISMATCH: 409, NULL_CRE_COMPILE_MISMATCH: 409, NULL_INTENT_EXPIRED: 409,
};
const server = createServer(async (request, response) => {
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
  if (request.method === 'GET' && request.url === '/health') { reply(authorizer ? 200 : 503, { status: authorizer ? 'configured' : 'unavailable', approvalExecuted: false }); return; }
  if (!['/api/organization/config', '/api/organization/prepare', '/api/organization/authorize'].includes(request.url ?? '') || !((request.url === '/api/organization/config' && request.method === 'GET') || (request.url !== '/api/organization/config' && request.method === 'POST'))) { reply(404, { code: 'NULL_NOT_FOUND' }); request.resume(); return; }
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
    clearExpired();
    if (request.url === '/api/organization/prepare') {
      if (intents.size >= 500) throw new OrganizationError('NULL_ORGANIZATION_BUSY', 503);
      const intent = parseIntent(body);
      const authorizationRequest = await authorizer.prepare(intent.publicInputs, intent.expected);
      const ticket = randomUUID();
      const expiresAt = Number(authorizationRequest.headers['privy-request-expiry']);
      intents.set(ticket, { ...intent, userId: session.user_id, sessionId: session.session_id, expiresAt });
      reply(200, { ticket, authorizationRequest, walletAddress: config.walletAddress, minimumApprovals: config.minimumApprovals }); return;
    }
    exact(body, ['ticket', 'signatures']);
    if (typeof body.ticket !== 'string' || !/^[a-f0-9-]{36}$/.test(body.ticket) || !Array.isArray(body.signatures) || body.signatures.some(value => typeof value !== 'string')) throw new OrganizationError('NULL_REQUEST_REJECTED');
    const prepared = intents.get(body.ticket);
    if (!prepared || prepared.expiresAt <= Date.now()) throw new OrganizationError('NULL_INTENT_EXPIRED', 409);
    if (prepared.userId !== session.user_id || prepared.sessionId !== session.session_id) throw new OrganizationError('NULL_ORGANIZATION_FORBIDDEN', 403);
    // Consume before signing so concurrent requests cannot repurpose or duplicate a prepared approval.
    intents.delete(body.ticket);
    const result = await authorizer.authorize({ publicInputs: prepared.publicInputs, expected: prepared.expected, requestExpiryMs: prepared.expiresAt, signatures: body.signatures as string[] });
    reply(200, result);
  } catch (error) {
    if (error instanceof OrganizationError) { if (error.status === 429) response.setHeader('retry-after', '60'); reply(error.status, { code: error.code }); }
    else if (error instanceof Error && safeErrors[error.message]) reply(safeErrors[error.message], { code: error.message });
    else reply(503, { code: 'NULL_ORGANIZATION_UNAVAILABLE' });
    request.resume();
  }
});
server.requestTimeout = 30_000; server.headersTimeout = 10_000;
const port = Number(process.env.ORGANIZATION_PORT ?? '8788');
server.listen(port, '127.0.0.1', () => console.info(`NULL organization API listening on port ${port}; ${authorizer ? 'configured' : 'configuration required'}`));
