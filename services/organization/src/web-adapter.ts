import serverless from 'serverless-http';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Keep the local and hosted API on the same authenticated request handler. */
export function webHandler(handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>) {
  const handle = serverless(handler);
  return async (request: Request, ip: string): Promise<Response> => {
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = request.body?.getReader();
    if (reader) {
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.length;
          if (size > 32_768) {
            await reader.cancel();
            return Response.json({ code: 'NULL_PAYLOAD_TOO_LARGE' }, { status: 413, headers: { 'cache-control': 'no-store' } });
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/\.netlify\/functions\/organization(?=\/)/, '');
    const result = await handle({
      path, httpMethod: request.method, headers: Object.fromEntries(request.headers),
      multiValueHeaders: {}, queryStringParameters: Object.fromEntries(url.searchParams), multiValueQueryStringParameters: null,
      requestContext: { identity: { sourceIp: ip } },
      body: chunks.length ? Buffer.concat(chunks).toString('base64') : null, isBase64Encoded: true,
    }, {} as never) as { statusCode: number; headers?: Record<string, string | number>; body?: string; isBase64Encoded?: boolean };
    const headers = new Headers(Object.entries(result.headers ?? {}).map(([key, value]) => [key, String(value)]));
    const body = request.method === 'HEAD' || [204, 304].includes(result.statusCode) ? null : result.isBase64Encoded ? Buffer.from(result.body ?? '', 'base64') : result.body ?? '';
    return new Response(body, { status: result.statusCode, headers });
  };
}
