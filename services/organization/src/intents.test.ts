import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryIntents } from './intents';
import { blobIntents } from './blob-intents';

test('memory approval tickets expire and can be consumed once', async () => {
  const store = memoryIntents();
  await store.put('a', {userId:'test',sessionId:'session',expiresAt:Date.now()+10000});
  assert.ok(await store.get('a'));
  assert.equal(await store.consume('a'), true);
  assert.equal(await store.consume('a'), false);
  await store.put('b', {userId:'test',sessionId:'session',expiresAt:Date.now()-1});
  assert.equal(await store.get('b'), undefined);
});

test('shared approval storage survives instances, preserves bigint and atomically rejects concurrent consumption', async () => {
  const data = new Map<string,{data:string;etag:string}>(); let version = 0;
  const backend = {
    async get(key:string) {return data.get(key)?.data ?? null;},
    async getWithMetadata(key:string) {return data.get(key) ?? null;},
    async set(key:string,value:string,conditions:{onlyIfNew?:boolean;onlyIfMatch?:string}) {
      const old = data.get(key);
      if (conditions.onlyIfNew && old || conditions.onlyIfMatch && conditions.onlyIfMatch !== old?.etag) return {modified:false};
      const entry = {data:value,etag:String(++version)};data.set(key,entry);return {modified:true,etag:entry.etag};
    },
  };
  const one = blobIntents(backend as unknown as Parameters<typeof blobIntents>[0]);
  const two = blobIntents(backend as unknown as Parameters<typeof blobIntents>[0]);
  await one.put('distribution/test', {userId:'test',sessionId:'session',expiresAt:Date.now()+10000,expected:{chainId:11155111n}});
  assert.deepEqual((await two.get('distribution/test'))?.expected,{chainId:11155111n});
  assert.equal((await Promise.all([one.consume('distribution/test'),two.consume('distribution/test')])).filter(Boolean).length,1);
  assert.equal(await two.get('distribution/test'),undefined);
  assert.equal(await two.consume('distribution/test'),false);
  await assert.rejects(one.put('distribution/test',{userId:'test',sessionId:'session',expiresAt:Date.now()+10000}));
});

test('storage verifies the write instead of trusting an incorrect success response', async () => {
  const backend = {async set(){return {modified:true};},async get(){return null;}};
  const store = blobIntents(backend as unknown as Parameters<typeof blobIntents>[0]);
  await assert.rejects(store.put('a',{userId:'test',sessionId:'session',expiresAt:Date.now()+10000}));
});
