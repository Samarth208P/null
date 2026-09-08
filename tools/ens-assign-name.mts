/** Assign a real Sepolia subname to a recipient wallet without publishing their Payment ID.
 * --wallet ADDRESS --label LABEL [--broadcast]. The default is a read-only plan. */
import { readFile, writeFile, rename } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readRootEnv } from '../contracts/scripts/env.mjs';
import { createPublicClient, createWalletClient, http, encodeFunctionData, getAddress, keccak256, stringToHex, zeroAddress, type Abi, type Address, type Hex } from '../apps/web/node_modules/viem/_esm/index.js';
import { privateKeyToAccount } from '../apps/web/node_modules/viem/_esm/accounts/index.js';
import { sepolia } from '../apps/web/node_modules/viem/_esm/chains/index.js';
import { PAYMENT_RECORD, inspectPaymentName, normalizePaymentName, paymentEditorAccess, preparePaymentDelegate } from '../packages/ens/src/index.ts';
const option = (name: string) => process.argv[process.argv.indexOf(name) + 1];
let stage = 'preflight';
async function main() {
  if (!process.argv.includes('--wallet') || !process.argv.includes('--label')) throw Error('Use --wallet ADDRESS --label LABEL [--broadcast]');
  const recipient = getAddress(option('--wallet'));
  const label = normalizePaymentName(`${option('--label')}.eth`).slice(0, -4);
  assert.ok(/^[a-z0-9-]{3,32}$/.test(label), 'Use a neutral label with 3–32 letters, digits or hyphens');
  const deployment = JSON.parse(await readFile('deployments/ens-sepolia.json', 'utf8'));
  const source = JSON.parse(await readFile('tools/ens/sepolia-contracts.json', 'utf8')).contracts;
  const registry = {address: deployment.registry as Address, abi: source.UserRegistryImpl.abi as Abi};
  const ethRegistry = {address: source.ETHRegistry.address as Address, abi: source.ETHRegistry.abi as Abi};
  const client = createPublicClient({chain:sepolia,transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:25_000,retryCount:1}),cacheTime:0});
  assert.equal(await client.getChainId(), 11155111);
  const owner = privateKeyToAccount(readRootEnv().NULL_DEPLOYER_PRIVATE_KEY as Hex);
  assert.equal(owner.address.toLowerCase(), deployment.owner.toLowerCase());
  const parent = await client.readContract({...ethRegistry,functionName:'getState',args:[BigInt(keccak256(stringToHex(deployment.namespace.slice(0,-4))))]}) as {latestOwner:Address;expiry:bigint};
  assert.equal(parent.latestOwner.toLowerCase(), owner.address.toLowerCase());
  const name = `${label}.${deployment.namespace}`;
  const existing = await client.readContract({...registry,functionName:'getState',args:[BigInt(keccak256(stringToHex(label)))]}) as {latestOwner:Address;expiry:bigint};
  assert.ok(existing.latestOwner === zeroAddress || existing.latestOwner.toLowerCase() === recipient.toLowerCase(), 'This name belongs to another recipient');
  console.log(JSON.stringify({name,recipient,recordKey:PAYMENT_RECORD,profilePublished:false,maxGasBudgetTestETH:'0.003',recipientGasFundingTestETH:'0.0005',broadcast:process.argv.includes('--broadcast')}));
  if (!process.argv.includes('--broadcast')) return;
  const path = `.artifacts/ens-assignment-${label}-${recipient.toLowerCase()}.json`;
  let journal: {name:string;recipient:Address;transactions:{step:string;hash:Hex}[];reserved:string} = {name,recipient,transactions:[],reserved:'0'};
  try {journal=JSON.parse(await readFile(path,'utf8'));} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const wallet=createWalletClient({account:owner,chain:sepolia,transport:http(client.transport.url,{retryCount:0})});
  async function send(step:string,to:Address,data:Hex,value=0n) {
    stage=step;
    const prior=journal.transactions.find(item=>item.step===step);
    if(prior){assert.equal((await client.waitForTransactionReceipt({hash:prior.hash,confirmations:2,timeout:90_000})).status,'success');return;}
    const gas=(await client.estimateGas({account:owner.address,to,data,value}))*125n/100n;
    const reserve=gas*2_000_000_000n;
    assert.ok(BigInt(journal.reserved)+reserve<=3_000_000_000_000_000n,'Assignment gas budget exceeded');
    assert.ok((await client.getBlock()).baseFeePerGas!<1_900_000_000n,'Assignment gas price cap reached');
    const prepared=await wallet.prepareTransactionRequest({to,data,value,gas,maxFeePerGas:2_000_000_000n,maxPriorityFeePerGas:100_000_000n});
    const serialized=await wallet.signTransaction(prepared);const hash=keccak256(serialized);
    journal.transactions.push({step,hash});journal.reserved=(BigInt(journal.reserved)+reserve).toString();
    await writeFile(path+'.tmp',JSON.stringify(journal,null,2));await rename(path+'.tmp',path);
    console.log(`${step}: ${hash}`);await client.sendRawTransaction({serializedTransaction:serialized});
    assert.equal((await client.waitForTransactionReceipt({hash,confirmations:2,timeout:90_000})).status,'success');
  }
  const roles=(1n<<20n)|(1n<<24n)|(1n<<148n)|(1n<<152n)|(1n<<156n);
  if(existing.latestOwner===zeroAddress) await send('assign-name',registry.address,encodeFunctionData({...registry,functionName:'register',args:[label,recipient,zeroAddress,deployment.resolver,roles,parent.expiry]}));
  const current=await inspectPaymentName(client,name);
  assert.equal(current.owner.toLowerCase(),recipient.toLowerCase());
  const grant=await preparePaymentDelegate(client,name,recipient,true,owner.address,current.resolver);
  await send('grant-payment-record',current.resolver,encodeFunctionData(grant.request));
  if(await client.getBalance({address:recipient})<500_000_000_000_000n) await send('fund-name-gas',recipient,'0x',500_000_000_000_000n);
  const access=await paymentEditorAccess(client,name,recipient);
  assert.deepEqual(access,{allowed:true,broaderAccess:false,recordAccess:true});
  console.log(JSON.stringify({name,owner:current.owner,liveRecordAccess:true,profilePublished:!!current.value,transactions:journal.transactions}));
}
try{await main();}catch(error){console.error(`Name assignment stopped during ${stage}. ${error instanceof assert.AssertionError?error.message.split('\n')[0]:'Check the saved transaction hashes and configuration before retrying.'}`);process.exitCode=1;}
