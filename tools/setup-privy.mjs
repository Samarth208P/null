import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { rootPath, readRootEnv, updateRootEnv } from '../contracts/scripts/env.mjs';

// This journal contains resource IDs and request hashes only, never credentials.
const journalPath = resolve(rootPath, '.artifacts/privy-provisioning.json');
const command = process.argv[2] ?? 'status';
const saved = readRootEnv();
const validId = value => typeof value === 'string' && /^[a-z0-9]{20,40}$/.test(value);
const fail = message => { throw new Error(message); };
const print = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
let journal = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : { version: 1, appId: saved.PRIVY_APP_ID, requests: {} };

function persist() {
  const temporary = `${journalPath}.${process.pid}.tmp`;
  try {
    closeSync(openSync(temporary, 'wx', 0o600));
    writeFileSync(temporary, JSON.stringify(journal, null, 2) + '\n');
    renameSync(temporary, journalPath);
  } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

async function request(path, body, requestKey) {
  const response = await fetch(`https://api.privy.io/v1/${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(25_000),
    headers: {
      'privy-app-id': saved.PRIVY_APP_ID,
      Authorization: `Basic ${Buffer.from(`${saved.PRIVY_APP_ID}:${saved.PRIVY_APP_SECRET}`).toString('base64')}`,
      ...(body ? { 'Content-Type': 'application/json', 'privy-idempotency-key': requestKey } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    // Never print provider response bodies, authorization headers, or fetch errors.
    const error = new Error(`Privy ${path.split('/')[0]} returned HTTP ${response.status}.`);
    error.httpStatus = response.status;
    throw error;
  }
  return response.json();
}

async function resource(stage, endpoint, body, variable) {
  const current = readRootEnv()[variable];
  if (current) {
    if (!validId(current)) fail(`Invalid ${variable}.`);
    return request(`${endpoint}/${current}`);
  }
  const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  let record = journal.requests[stage];
  if (record && record.bodyHash !== bodyHash) fail(`The saved ${stage} request has different inputs. Reconcile the existing resource before changing its configuration.`);
  if (record?.resourceId) {
    const existing = await request(`${endpoint}/${record.resourceId}`);
    updateRootEnv({ [variable]: existing.id });
    return existing;
  }
  if (!record) {
    record = journal.requests[stage] = { key: randomUUID(), bodyHash, createdAt: Date.now() };
    persist();
  }
  if (Date.now() - record.createdAt > 23 * 60 * 60 * 1000)
    fail(`The unresolved ${stage} request is older than the safe idempotency window. Check the provider before retrying.`);
  if (record.rejectedStatus) fail(`The ${stage} request was rejected with HTTP ${record.rejectedStatus}. Resolve provider compatibility before retrying.`);
  let result;
  try { result = await request(endpoint, body, record.key); }
  catch (error) {
    if (error.httpStatus >= 400 && error.httpStatus < 500) { record.rejectedStatus = error.httpStatus; persist(); }
    throw error;
  }
  if (!validId(result?.id)) fail(`Privy returned an invalid ${stage} resource ID; inspect the saved request before retrying.`);
  record.resourceId = result.id;
  persist();
  updateRootEnv({ [variable]: result.id });
  print({ stage, status: 'created', id: result.id });
  return result;
}

async function main() {
  if (!['status', 'provision'].includes(command) || process.argv.length > 3) fail('Usage: node tools/setup-privy.mjs [status|provision]');
  if (!saved.PRIVY_APP_ID || !saved.PRIVY_APP_SECRET || saved.VITE_PRIVY_APP_ID !== saved.PRIVY_APP_ID)
    fail('Set matching PRIVY_APP_ID / VITE_PRIVY_APP_ID and the server-only PRIVY_APP_SECRET in root .env.');
  if (journal.appId !== saved.PRIVY_APP_ID) fail('The provisioning journal belongs to another Privy app.');
  if (saved.NULL_CHAIN_ID !== '11155111') fail('This setup is restricted to the Sepolia project.');
  const users = await request('users?limit=10');
  if (command === 'status') {
    print({ credentialsAccepted: true, users: users.data?.map(user => ({ id: user.id })),
      organizationConfigured: Boolean(saved.PRIVY_ORGANIZATION_ENTITY_ID),
      walletConfigured: Boolean(saved.PRIVY_ORGANIZATION_WALLET_ID),
      policyConfigured: Boolean(saved.PRIVY_ORGANIZATION_POLICY_IDS), approvalExecuted: false });
    return;
  }
  const members = (saved.PRIVY_ORGANIZATION_MEMBER_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean);
  if (members.length !== 1 || !/^did:privy:[a-z0-9]+$/.test(members[0])) fail('Set the confirmed owner Privy DID in PRIVY_ORGANIZATION_MEMBER_IDS. This setup creates a single-owner demo quorum.');
  if (saved.PRIVY_ORGANIZATION_MINIMUM_APPROVALS !== '1') fail('This command does not lower an existing approval threshold.');
  if (!users.data?.some(user => user.id === members[0])) fail('The configured owner was not found in this Privy app.');
  const quorum = await resource('quorum', 'key_quorums', {
    display_name: 'NULL Sepolia owner', user_ids: members, authorization_threshold: 1,
  }, 'PRIVY_ORGANIZATION_OWNER_QUORUM_ID');
  if (quorum.authorization_threshold !== 1 || quorum.user_ids?.length !== 1 || quorum.user_ids[0] !== members[0] ||
      quorum.authorization_keys?.length || quorum.key_quorum_ids?.length) fail('The quorum differs from the configured single owner.');
  const organization = await resource('organization', 'organizations', {
    display_name: 'NULL Sepolia workspace', default_key_quorum_id: quorum.id,
  }, 'PRIVY_ORGANIZATION_ENTITY_ID');
  if (organization.default_key_quorum_id !== quorum.id) fail('The organization has a different owner quorum.');
  // A live check on 2026-09-06 returned HTTP 400 / invalid_enum_value for
  // rules.0.method = secp256k1_sign. Do not retry a known unsupported policy,
  // substitute another signed digest, or create a wallet without its controls.
  print({ status: 'organization-provisioned', approvalExecuted: false, approvalAvailable: false,
    blocker: 'Privy policy rules currently reject the raw-signing method required by the NULL circuit.',
    next: 'Keep VITE_ORGANIZATION_URL blank and use the existing local treasury approval CLI until a supported restrictive policy is verified.' });
}

main().catch(error => { process.stderr.write(error.httpStatus ? `${error.message}\n` : 'Privy setup stopped: ' + (error instanceof TypeError ? 'request failed; preserve the journal before retrying.' : error.message) + '\n'); process.exitCode = 1; });
