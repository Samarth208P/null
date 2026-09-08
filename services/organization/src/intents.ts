export interface StoredIntent { userId: string; sessionId: string; expiresAt: number; [key: string]: unknown }
export interface IntentStore {
  put(key: string, value: StoredIntent): Promise<void>;
  get(key: string): Promise<StoredIntent | undefined>;
  consume(key: string): Promise<boolean>;
}
export function memoryIntents(): IntentStore {
  const entries = new Map<string, StoredIntent>();
  return {
    async put(key, value) {
      for (const [id, item] of entries) if (item.expiresAt <= Date.now()) entries.delete(id);
      if (entries.size >= 1000) throw new Error('NULL_ORGANIZATION_BUSY');
      entries.set(key, value);
    },
    async get(key) { const value = entries.get(key); return value && value.expiresAt > Date.now() ? value : undefined; },
    async consume(key) { return entries.delete(key); },
  };
}
