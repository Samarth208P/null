import { ProofWorker } from './proof-worker-adapter.mts';
import { readFile, writeFile, rename, mkdir, access } from 'node:fs/promises';
import { randomBytes as nodeRandom, createCipheriv, createDecipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readRootEnv, updateRootEnv } from '../contracts/scripts/env.mjs';
import { NullLiveClient, type SecretCheckpoint, type OwnedTreasuryNote } from '../packages/client/src/index.ts';
import { authPolicyCommitment, compileDistribution, fromHex, toHex, randomBytes, deriveField, utf8, secp256k1, profileFromKeys } from '../packages/sdk/src/index.ts';
import { createPublicClient, createWalletClient, http, parseAbi, keccak256 } from '../apps/web/node_modules/viem/_esm/index.js';
import { privateKeyToAccount, generatePrivateKey } from '../apps/web/node_modules/viem/_esm/accounts/index.js';
import { sepolia } from '../apps/web/node_modules/viem/_esm/chains/index.js';

Object.assign(globalThis,{Worker:ProofWorker});
const path = '.artifacts/sepolia-rehearsal.enc.json';
const publicPath = '.artifacts/sepolia-rehearsal-receipt.json';
const amount = 100_000n; // 0.1 test USDC, permanently inside the testnet pool.
const maxFee = 1_000_000_000n, budget = 15_000_000_000_000_000n; // <= 0.015 test ETH reserved gas.
const manifest = JSON.parse(await readFile('deployments/11155111.json','utf8'));
const saved = readRootEnv();
const account = privateKeyToAccount(saved.NULL_DEPLOYER_PRIVATE_KEY as `0x${string}`);
const rpc = createPublicClient({chain:sepolia,transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:25000,retryCount:1})});
const rawWallet = createWalletClient({account,chain:sepolia,transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:25000,retryCount:0})});
const tokenAbi = parseAbi(['function balanceOf(address) view returns(uint256)']);
const balances = await Promise.all([rpc.getBalance({address:account.address}),rpc.readContract({address:manifest.asset.address,abi:tokenAbi,functionName:'balanceOf',args:[account.address]})]);
const plan={network:'Ethereum Sepolia',chainId:11155111,pool:manifest.contracts.nullPool,funder:account.address,testUsdc:'0.1',maxTestEthGasBudget:'0.015',testEthAvailable:balances[0].toString(),testUsdcAtomicAvailable:balances[1].toString(),withdrawalsAvailable:false,authorization:'local isolated rehearsal signer; not a Privy approval',broadcast:process.argv.includes('--broadcast')};
console.log(JSON.stringify(plan,null,2));
if(!process.argv.includes('--broadcast'))process.exit(0);
if(balances[0]<budget || balances[1]<amount)throw Error('Insufficient test funds for this bounded rehearsal.');
try {await access(path);throw Error('A rehearsal journal already exists. Reconcile it before starting another run.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
if(!saved.NULL_REHEARSAL_ENCRYPTION_KEY){updateRootEnv({NULL_REHEARSAL_ENCRYPTION_KEY:nodeRandom(32).toString('hex')});}
const sealKey=Buffer.from(readRootEnv().NULL_REHEARSAL_ENCRYPTION_KEY!,'hex');
const stringify=(value:unknown)=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?{$bigint:v.toString()}:v);
const parse=(text:string)=>JSON.parse(text,(_,v)=>v&&typeof v==='object'&&Object.keys(v).length===1&&typeof v.$bigint==='string'?BigInt(v.$bigint):v);
const state:{checkpoints:SecretCheckpoint[];signedTransactions:{hash:string;serialized:string}[];[key:string]:unknown}={checkpoints:[],signedTransactions:[]};
async function save(){await mkdir('.artifacts',{recursive:true});const nonce=nodeRandom(12);const cipher=createCipheriv('aes-256-gcm',sealKey,nonce);cipher.setAAD(Buffer.from('NULL Sepolia rehearsal v1'));const encrypted=Buffer.concat([cipher.update(stringify(state),'utf8'),cipher.final()]);await writeFile(path+'.tmp',JSON.stringify({version:1,nonce:nonce.toString('hex'),tag:cipher.getAuthTag().toString('hex'),ciphertext:encrypted.toString('hex')}));await rename(path+'.tmp',path);}
let reserved=0n;
const wallet={...rawWallet,sendTransaction:async(args:any)=>{
  const gas=args.gas??(await rpc.estimateGas({...args,account:account.address}))*120n/100n;
  if(reserved+gas*maxFee>budget)throw Error('Rehearsal gas budget exceeded.');
  const latest=await rpc.getBlock();if((latest.baseFeePerGas??0n)>maxFee/2n)throw Error('Gas price exceeds the rehearsal cap.');
  const request=await rawWallet.prepareTransactionRequest({...args,account,gas,maxFeePerGas:maxFee,maxPriorityFeePerGas:100_000_000n});
  const serialized=await rawWallet.signTransaction(request);const hash=keccak256(serialized);
  state.signedTransactions.push({hash,serialized});reserved+=gas*maxFee;await save();
  try{return await rpc.sendRawTransaction({serializedTransaction:serialized});}catch{throw Error('Submission uncertain; saved signed transaction must be reconciled before retrying.');}
}};
const context={chainId:11155111n,poolAddress:manifest.contracts.nullPool};
const signer=generatePrivateKey();const seed=randomBytes(32);
const policy={signerPublicKey:toHex(secp256k1.getPublicKey(fromHex(signer),true)),policyMetadata:deriveField(seed,utf8('demo-policy')),registrationBlinder:deriveField(seed,utf8('demo-blinder'))};
const keys={spendPrivateKey:fromHex(generatePrivateKey()),viewPrivateKey:fromHex(generatePrivateKey())};
state.signer=signer;state.policy=policy;state.recipientKeys={spend:toHex(keys.spendPrivateKey),view:toHex(keys.viewPrivateKey)};await save();
const evidence:{steps:unknown[];[key:string]:unknown}={...plan,startedAt:new Date().toISOString(),steps:[],completed:false};
const live=new NullLiveClient({manifest,rpcUrls:['https://ethereum-sepolia-rpc.publicnode.com'],graphUrl:'https://api.studio.thegraph.com/query/1758859/null-protocol/v0.1.0',artifactBaseUrl:'https://null-protocol.netlify.app',confirmations:3,receiptTimeoutMs:180000,maxGas:3_000_000n,persistLocalSecret:async cp=>{state.checkpoints.push(cp);await save();}});
const progress={onProgress:(stage:string)=>console.log(stage),onTransactionSubmitted:async(tx:unknown)=>{evidence.steps.push(tx);await writeFile(publicPath,JSON.stringify(evidence,null,2));}};
try {
 await live.registerPolicy({opening:policy,wallet:wallet as any,persistLocalPolicy:async()=>save(),...progress});
 const shield=await live.prepareShield({amountAtomic:amount,policyCommitment:authPolicyCommitment(policy),acknowledgePublicDeposit:true,...progress});
 const funded=await live.submit(shield,{mode:'wallet',wallet:wallet as any},progress);
 const compiled=await compileDistribution({context,recipients:[{employeeRef:'Rehearsal recipient',amountAtomic:amount,stealthMetaAddress:profileFromKeys(keys).stealthMetaAddress}]});
 const distribution=await live.prepareDistribution({compiled,treasuryNotes:[funded.note as OwnedTreasuryNote],authPolicy:policy,authorize:async intent=>toHex(secp256k1.sign(fromHex(intent.digest),fromHex(signer),{prehash:false,lowS:true}).toCompactRawBytes()),...progress});
 await live.submit(distribution,{mode:'wallet',wallet:wallet as any},progress);
 const found=await live.discover({keys,...progress});
 state.discovery=found;await save();
 if(found.length!==1)throw Error('Expected exactly one live allocation.');
 const claim=await live.prepareClaim({allocation:found[0],...progress});
 await live.submit(claim,{mode:'wallet',wallet:wallet as any},progress);
 const encrypted=JSON.parse(await readFile(path,'utf8'));const decipher=createDecipheriv('aes-256-gcm',sealKey,Buffer.from(encrypted.nonce,'hex'));decipher.setAAD(Buffer.from('NULL Sepolia rehearsal v1'));decipher.setAuthTag(Buffer.from(encrypted.tag,'hex'));const restored=parse(Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext,'hex')),decipher.final()]).toString('utf8'));
 if(restored.checkpoints.filter((cp:SecretCheckpoint)=>cp.phase==='confirmed').length!==3)throw Error('Recovery verification failed.');
 evidence.completed=true;evidence.recoveryVerified=true;evidence.finishedAt=new Date().toISOString();console.log('PASS shield -> distribute -> discover -> claim; encrypted journal recovered.');
}catch{evidence.failure='Rehearsal stopped. Preserve the encrypted journal and reconcile saved transaction hashes before retrying.';process.exitCode=1;console.error(evidence.failure);}
finally{await writeFile(publicPath,JSON.stringify(evidence,null,2));sealKey.fill(0);seed.fill(0);keys.spendPrivateKey.fill(0);keys.viewPrivateKey.fill(0);}
