import type { Context } from '@netlify/functions';
import { organizationHandler, useIntentStore } from './server.js';
import { blobIntents } from './blob-intents.js';
import { webHandler } from './web-adapter.js';

const handle = webHandler(organizationHandler);
export default async function organization(request: Request, context: Context): Promise<Response> {
  // The modern runtime supplies the full Blobs context, including the uncached
  // endpoint required for strong reads. Legacy connectLambda drops that field.
  try { useIntentStore(blobIntents()); }
  catch { return Response.json({ code: 'NULL_ORGANIZATION_UNAVAILABLE' }, { status: 503, headers: { 'cache-control': 'no-store' } }); }
  return handle(request, context.ip);
}
