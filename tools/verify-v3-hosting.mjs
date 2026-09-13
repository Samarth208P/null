import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const base = new URL(process.argv[2]);
assert.equal(base.protocol, 'https:');
assert.ok(base.hostname.endsWith('.netlify.app'));
const manifest = JSON.parse(await readFile('apps/web/public/deployment.json', 'utf8'));
async function get(path) {
  const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(60_000), cache: 'no-store' });
  assert.equal(response.status, 200, path);
  return response;
}
const remote = await (await get('/deployment.json')).json();
assert.deepEqual(remote, manifest, 'Hosted deployment differs from the tested release.');
assert.equal(remote.protocolVersion, '0.3.0');
assert.equal(remote.security.partialWithdrawalsImplemented, true);
const artifacts = await Promise.all(Object.entries(remote.build.circuitArtifacts).map(async ([kind, artifact]) => {
  let data;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { data = Buffer.from(await (await get(artifact.url)).arrayBuffer()); break; }
    catch (error) {
      if (attempt === 3 || !['TypeError','TimeoutError','AbortError'].includes(error?.name)) throw error;
      console.warn(`Retrying interrupted ${kind} artifact download (${attempt}/3).`);
    }
  }
  const sha256 = `0x${createHash('sha256').update(data).digest('hex')}`;
  assert.equal(sha256, artifact.sha256, `Hosted ${kind} artifact checksum mismatch.`);
  return { kind, bytes: data.length, sha256 };
}));
assert.equal(artifacts.length, 5);
const html = await (await get('/')).text();
const entry = html.match(/<script[^>]+src="([^"]+)"/i)?.[1];
assert.ok(entry, 'Application entry is missing.');
await get(entry);
const api = await fetch(new URL('/api/organization/config', base), { redirect: 'error', signal: AbortSignal.timeout(60_000) });
const staticOnly = process.argv.includes('--static-only');
if (!staticOnly) assert.equal(api.status, 401, 'Organization service must load and reject an unauthenticated request.');
const result = { checkedAt: new Date().toISOString(), url: base.origin, pool: remote.contracts.nullPool, version: remote.protocolVersion, entry, artifacts, organizationUnauthenticatedStatus: api.status, scope: staticOnly ? 'static release and artifact integrity only; API status recorded separately' : 'static release, artifact integrity and organization API availability', passed: true };
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
