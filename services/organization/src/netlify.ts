import serverless from 'serverless-http';
import type { Handler, HandlerResponse } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { organizationHandler, useIntentStore } from './server.js';
import { blobIntents } from './blob-intents.js';

const handle = serverless(organizationHandler);
export const handler: Handler = async (event, context) => {
  // Netlify provides scoped blob credentials. No browser or manual storage token.
  if (!('blobs' in event) || typeof event.blobs !== 'string') return { statusCode: 503, body: JSON.stringify({code:'NULL_ORGANIZATION_UNAVAILABLE'}) };
  connectLambda(event as Parameters<typeof connectLambda>[0]);
  useIntentStore(blobIntents());
  const path = event.path.replace(/^\/\.netlify\/functions\/organization(?=\/)/, '');
  return await handle({ ...event, path }, context) as HandlerResponse;
};
