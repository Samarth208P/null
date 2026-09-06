import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Hex } from 'viem';
import { createRelayer, RelayError, type RelayManifest } from './relay.js';

const port = Number(process.env.RELAYER_PORT ?? '8787');
const origins = new Set((process.env.RELAYER_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean));
let relayer: ReturnType<typeof createRelayer> | undefined;
try {
  if (process.env.NULL_MANIFEST_PATH && process.env.RELAYER_RPC_URL && process.env.RELAYER_PRIVATE_KEY) {
    const manifest = JSON.parse(await readFile(process.env.NULL_MANIFEST_PATH, 'utf8')) as RelayManifest;
    relayer = createRelayer({ manifest, rpcUrl: process.env.RELAYER_RPC_URL, privateKey: process.env.RELAYER_PRIVATE_KEY as Hex });
    await relayer.verifyDeployment();
  }
} catch { relayer = undefined; }
const buckets = new Map<string, { count: number; reset: number }>();
function admit(ip: string) {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key);
  if (buckets.size >= 20_000 && !buckets.has(ip)) return false;
  const bucket = buckets.get(ip);
  if (!bucket || bucket.reset <= now) { buckets.set(ip, { count: 1, reset: now + 60_000 }); return true; }
  return ++bucket.count <= 12;
}
const server = createServer(async (request, response) => {
  const requestId = randomUUID();
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-request-id', requestId);
  const origin = request.headers.origin;
  if (origin) {
    if (!origins.has(origin)) { response.writeHead(403); response.end('{"code":"NULL_ORIGIN_REJECTED"}'); return; }
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  if (request.method === 'OPTIONS') { response.setHeader('access-control-allow-methods', 'POST, GET'); response.setHeader('access-control-allow-headers', 'content-type'); response.writeHead(204); response.end(); return; }
  if (request.method === 'GET' && request.url === '/health') { response.writeHead(relayer ? 200 : 503); response.end(JSON.stringify({ status: relayer ? 'configured' : 'unavailable', network: 'testnet', storesRecipientSecrets: false })); return; }
  if (request.method !== 'POST' || request.url !== '/api/relay') { response.writeHead(404); response.end('{"code":"NULL_NOT_FOUND"}'); return; }
  // Do not trust X-Forwarded-For supplied by clients. Configure per-IP limits at a trusted edge too.
  if (!admit(request.socket.remoteAddress ?? 'unknown')) { response.setHeader('retry-after', '60'); response.writeHead(429); response.end('{"code":"NULL_RATE_LIMITED"}'); request.resume(); return; }
  try {
    if (!relayer) throw new RelayError('NULL_DEPLOYMENT_UNAVAILABLE', 503);
    if (!request.headers['content-type']?.startsWith('application/json')) throw new RelayError('NULL_CONTENT_TYPE', 415);
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 300_000) throw new RelayError('NULL_PAYLOAD_TOO_LARGE', 413);
      chunks.push(Buffer.from(chunk));
    }
    let payload: unknown;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RelayError('NULL_PAYLOAD_REJECTED'); }
    const result = await relayer.relay(payload);
    response.writeHead(202); response.end(JSON.stringify(result));
  } catch (error) {
    const safe = error instanceof RelayError ? error : new RelayError('NULL_RELAY_UNAVAILABLE', 503);
    response.writeHead(safe.status); response.end(JSON.stringify({ code: safe.code, requestId }));
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.listen(port, '127.0.0.1', () => console.info(`NULL relayer listening on port ${port}; ${relayer ? 'configured' : 'deployment configuration required'}`));
