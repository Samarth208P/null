import test from 'node:test';
import assert from 'node:assert/strict';
import { webHandler } from './web-adapter';

test('modern function preserves the raw signed request, route, authentication and client IP', async () => {
  const handle = webHandler(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    assert.equal(req.url, '/api/organization/identify');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.authorization, 'Bearer synthetic-session');
    assert.equal(req.headers.origin, 'https://app.example.test');
    assert.equal(req.socket.remoteAddress, '192.0.2.4');
    assert.equal(Buffer.concat(chunks).toString(), '{"ticket":"synthetic","signatures":["test"]}');
    res.setHeader('cache-control', 'no-store'); res.writeHead(409); res.end('{"code":"NULL_INTENT_EXPIRED"}');
  });
  const response = await handle(new Request('https://app.example.test/.netlify/functions/organization/api/organization/identify', { method: 'POST', headers: { authorization: 'Bearer synthetic-session', origin: 'https://app.example.test', 'content-type': 'application/json' }, body: '{"ticket":"synthetic","signatures":["test"]}' }), '192.0.2.4');
  assert.equal(response.status, 409); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { code: 'NULL_INTENT_EXPIRED' });
});

test('modern function handles empty preflight and rejects oversized bodies before dispatch', async () => {
  let count = 0;
  const handle = webHandler(async (_req, res) => { count++; res.writeHead(204); res.end(); });
  const response = await handle(new Request('https://app.example.test/api/organization/config', { method: 'OPTIONS' }), '192.0.2.4');
  assert.equal(response.status, 204); assert.equal(await response.text(), '');
  const oversized = await handle(new Request('https://app.example.test/api/organization/identify', { method: 'POST', body: 'a'.repeat(32769) }), '192.0.2.4');
  assert.equal(oversized.status, 413); assert.equal(count, 1);
});
