import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import type { IntentStore, StoredIntent } from './intents.js';

// Shared, strongly consistent storage: prepare and approve may hit different instances.
// This contains session-bound public intents, never payroll, keys or user signatures.
// The SDK currently treats any conditional-write response except 412 as success.
// Reject transport failures before they can be mistaken for a persisted intent.
export const checkedBlobFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (!response.ok && !(response.status === 404 && ['GET', 'HEAD'].includes(method)) && !(response.status === 412 && method === 'PUT')) {
    console.warn(JSON.stringify({ event: 'null_intent_storage_http_failed', method, status: response.status }));
    throw new Error('NULL_ORGANIZATION_UNAVAILABLE');
  }
  return response;
};
export function blobIntents(store = getStore({ name: 'null-organization-intents-v1', consistency: 'strong', fetch: checkedBlobFetch })): IntentStore {
  const encode = (value: unknown) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? { $bigint: item.toString() } : item);
  const decode = (value: string): StoredIntent => JSON.parse(value, (_, item) => item && typeof item === 'object' && Object.keys(item).length === 1 && typeof item.$bigint === 'string' ? BigInt(item.$bigint) : item);
  return {
    async put(key, value) {
      const encoded = encode(value);
      const result = await store.set(key, encoded, { onlyIfNew: true });
      // Verify persistence too; never trust a failed conditional write as success.
      if (!result.modified || await store.get(key, { type: 'text' }) !== encoded) throw new Error('NULL_ORGANIZATION_UNAVAILABLE');
    },
    async get(key) {
      const text = await store.get(key, { type: 'text' }); if (!text) return undefined;
      const value = decode(text);
      return !value.consumedBy && value.expiresAt > Date.now() ? value : undefined;
    },
    async consume(key) {
      const entry = await store.getWithMetadata(key, { type: 'text' });
      if (!entry?.etag) return false;
      const value = decode(entry.data);
      if (value.consumedBy || value.expiresAt <= Date.now()) return false;
      const consumedBy = randomUUID();
      // Retain a tombstone through expiration, making concurrent/replayed approval fail.
      const encoded = encode({ expiresAt: value.expiresAt, consumedBy });
      const result = await store.set(key, encoded, { onlyIfMatch: entry.etag });
      return result.modified && await store.get(key, { type: 'text' }) === encoded;
    },
  };
}
