import test from 'node:test';
import assert from 'node:assert/strict';
import serverless from 'serverless-http';

test('serverless HTTP adapter keeps API routes and rejects unauthenticated or foreign-origin requests', async () => {
  Object.assign(process.env, {PRIVY_APP_ID:'testapp',PRIVY_APP_SECRET:'synthetic-test-secret',PRIVY_ORGANIZATION_WALLET_ID:'wallet',PRIVY_ORGANIZATION_WALLET_ADDRESS:'0x1111111111111111111111111111111111111111',PRIVY_ORGANIZATION_OWNER_QUORUM_ID:'quorum',PRIVY_ORGANIZATION_ENTITY_ID:'organization',PRIVY_ORGANIZATION_MEMBER_IDS:'did:privy:owner',PRIVY_ORGANIZATION_CONTROL_MODE:'owner-quorum',PRIVY_ORGANIZATION_MINIMUM_APPROVALS:'1',NULL_CHAIN_ID:'11155111',NULL_POOL_ADDRESS:'0x2222222222222222222222222222222222222222',ORGANIZATION_ALLOWED_ORIGINS:'https://app.example.test'});
  const {organizationHandler} = await import('./server.js');
  const handle=serverless(organizationHandler);
  const request=async(path:string,method='GET',headers:Record<string,string>={})=>handle({path,httpMethod:method,headers,multiValueHeaders:{},queryStringParameters:null,multiValueQueryStringParameters:null,requestContext:{},body:null,isBase64Encoded:false},{} as never) as Promise<{statusCode:number;body:string}>;
  const missing=await request('/api/organization/config');assert.equal(missing.statusCode,401);assert.equal(JSON.parse(missing.body).code,'NULL_SESSION_REQUIRED');
  const health=await request('/health');assert.equal(health.statusCode,200);
  assert.deepEqual(JSON.parse(health.body),{status:'configured',approvalExecution:'not-tracked'});
  assert.equal((await request('/api/organization/config','GET',{origin:'https://attacker.example.test'})).statusCode,403);
  assert.equal((await request('/api/organization/config','OPTIONS',{origin:'https://app.example.test'})).statusCode,204);
  assert.equal((await request('/api/organization/unknown')).statusCode,404);
  assert.equal((await request('/api/organization/config','POST')).statusCode,404);
});
