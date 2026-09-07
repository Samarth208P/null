import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';
import { preparePrivateStorage, readEnvironment, readStoredPayroll } from './payroll-storage.js';

function reply(response: ServerResponse, status: number, body: string) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', 'Connection': 'close' });
  response.end(body);
}

try {
  const environment = readEnvironment();
  const token = environment.NULL_PAYROLL_API_TOKEN;
  if (!token || token.length < 32 || token.length > 4_096 || /[^\x21-\x7e]/.test(token)) throw new Error('NULL_PAYROLL_TOKEN_REQUIRED');
  const configuredPort = environment.NULL_PAYROLL_PORT || '8789';
  if (!/^[1-9][0-9]{0,4}$/.test(configuredPort) || Number(configuredPort) > 65_535) throw new Error('NULL_PAYROLL_PORT_INVALID');
  const port = Number(configuredPort);
  const expected = createHash('sha256').update(`Bearer ${token}`).digest();
  preparePrivateStorage();
  const server = createServer({ maxHeaderSize: 8_192, requestTimeout: 5_000, headersTimeout: 5_000, keepAliveTimeout: 1_000 }, (request, response) => {
    try {
      const provided = typeof request.headers.authorization === 'string' ? request.headers.authorization : '';
      const authenticated = timingSafeEqual(createHash('sha256').update(provided).digest(), expected);
      let authorizationHeaders = 0;
      for (let index = 0; index < request.rawHeaders.length; index += 2)
        if (request.rawHeaders[index].toLowerCase() === 'authorization') authorizationHeaders += 1;
      if (!authenticated || authorizationHeaders !== 1) { reply(response, 401, '{"error":"unauthorized"}'); return; }
      if (request.headers.origin !== undefined || request.headers.host !== `127.0.0.1:${port}`) { reply(response, 403, '{"error":"forbidden"}'); return; }
      if (request.method !== 'GET') { reply(response, 405, '{"error":"method_not_allowed"}'); return; }
      if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
        reply(response, 400, '{"error":"invalid_request"}'); return;
      }
      const match = /^\/batches\/([a-zA-Z0-9_-]{1,80})$/.exec(request.url || '');
      if (!match) { reply(response, 404, '{"error":"not_found"}'); return; }
      const bytes = readStoredPayroll(match[1]);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', 'Connection': 'close' });
      response.end(bytes, () => bytes.fill(0));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') reply(response, 404, '{"error":"not_found"}');
      else reply(response, 500, '{"error":"unavailable"}');
    }
  });
  server.maxConnections = 16;
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  server.on('error', () => { process.stderr.write('NULL_PAYROLL_SERVER_FAILED\n'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Local authenticated payroll API listening at http://127.0.0.1:${port}. No batches are logged.\n`));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(); server.closeAllConnections(); });
} catch (error) {
  const code = error instanceof Error && /^NULL_[A-Z_]+$/.test(error.message) ? error.message : 'NULL_PAYROLL_SERVER_FAILED';
  process.stderr.write(code + '\n');
  process.exitCode = 1;
}
