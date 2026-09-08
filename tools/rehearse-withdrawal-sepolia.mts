import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ProofWorker } from './proof-worker-adapter.mts';
import { readFile, writeFile, rename, mkdir, access } from 'node:fs/promises';
import { randomBytes as nodeRandom, createCipheriv, createDecipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readRootEnv, updateRootEnv } from '../contracts/scripts/env.mjs';
import { NullLiveClient, type SecretCheckpoint, type OwnedTreasuryNote } from '../packages/client/src/index.ts';
import { authPolicyCommitment, compileDistribution, fromHex, toHex, randomBytes, deriveField, utf8, secp256k1, profileFromKeys } from '../packages/sdk/src/index.ts';
import { createPublicClient, createWalletClient, http, parseAbi, keccak256, parseTransaction, recoverTransactionAddress, encodeFunctionData } from '../apps/web/node_modules/viem/_esm/index.js';
import { privateKeyToAccount, generatePrivateKey } from '../apps/web/node_modules/viem/_esm/accounts/index.js';
import { sepolia } from '../apps/web/node_modules/viem/_esm/chains/index.js';

Object.assign(globalThis,{Worker:ProofWorker});
const path = '.artifacts/sepolia-withdrawal-rehearsal.enc.json';
const publicPath = '.artifacts/sepolia-withdrawal-rehearsal-receipt.json';
const amount = 100_000n; // 0.1 test USDC, returned through recipient withdrawal and treasury refund.
const manifest = JSON.parse(await readFile('deployments/11155111-withdrawals-v2.json','utf8'));
const deploymentSpent=manifest.transactions.reduce((sum:bigint,tx:any)=>sum+BigInt(tx.gasUsed)*BigInt(tx.effectiveGasPrice),0n);
const maxFee=2_000_000_000n, combinedBudget=65_000_000_000_000_000n;
// Explicitly authorized reallocation; the combined ceiling is stricter than 0.035 here.
const budget=combinedBudget-deploymentSpent<35_000_000_000_000_000n?combinedBudget-deploymentSpent:35_000_000_000_000_000n;
const saved = readRootEnv();
const account = privateKeyToAccount(saved.NULL_DEPLOYER_PRIVATE_KEY as `0x${string}`);
const rpc = createPublicClient({chain:sepolia,transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:25000,retryCount:1})});
const rawWallet = createWalletClient({account,chain:sepolia,transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:25000,retryCount:0})});
const tokenAbi = parseAbi(['function balanceOf(address) view returns(uint256)']);
const balances = await Promise.all([rpc.getBalance({address:account.address}),rpc.readContract({address:manifest.asset.address,abi:tokenAbi,functionName:'balanceOf',args:[account.address]})]);
const plan={network:'Ethereum Sepolia',chainId:11155111,pool:manifest.contracts.nullPool,funder:account.address,testUsdc:'0.1',maxGasBudgetWei:budget.toString(),combinedDeploymentRehearsalCapEth:'0.065',testEthAvailable:balances[0].toString(),testUsdcAtomicAvailable:balances[1].toString(),withdrawalsAvailable:true,authorization:'local isolated rehearsal signer; not a Privy approval',broadcast:process.argv.includes('--broadcast')};
console.log(JSON.stringify(plan,null,2));
if(!process.argv.includes('--broadcast'))process.exit(0);
if(balances[0]<budget || balances[1]<amount)throw Error('Insufficient test funds for this bounded rehearsal.');
const resumeRefund=process.argv.includes('--resume-refund');
let resumeEmpty=false;
try {await access(path);if(!process.argv.includes('--resume-setup') && !resumeRefund)throw Error('A rehearsal journal already exists. Reconcile it before starting another run.');resumeEmpty=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
if(!saved.NULL_REHEARSAL_ENCRYPTION_KEY){updateRootEnv({NULL_REHEARSAL_ENCRYPTION_KEY:nodeRandom(32).toString('hex')});}
const sealKey=Buffer.from(readRootEnv().NULL_REHEARSAL_ENCRYPTION_KEY!,'hex');
const stringify=(value:unknown)=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?{$bigint:v.toString()}:v);
const parse=(text:string)=>JSON.parse(text,(_,v)=>v&&typeof v==='object'&&Object.keys(v).length===1&&typeof v.$bigint==='string'?BigInt(v.$bigint):v);
const state:{checkpoints:SecretCheckpoint[];signedTransactions:{hash:string;serialized:string}[];[key:string]:unknown}={checkpoints:[],signedTransactions:[]};
if(resumeEmpty){const sealed=JSON.parse(await readFile(path,'utf8'));const decipher=createDecipheriv('aes-256-gcm',sealKey,Buffer.from(sealed.nonce,'hex'));decipher.setAAD(Buffer.from('NULL Sepolia withdrawal rehearsal v1'));decipher.setAuthTag(Buffer.from(sealed.tag,'hex'));const prior=parse(Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext,'hex')),decipher.final()]).toString('utf8'));Object.assign(state,prior);
 const registration=encodeFunctionData({abi:parseAbi(['function register(uint256)']),functionName:'register',args:[BigInt(authPolicyCommitment(state.policy as any))]});
 const approval=encodeFunctionData({abi:parseAbi(['function approve(address,uint256) returns(bool)']),functionName:'approve',args:[manifest.contracts.nullPool,amount]});
 if(resumeRefund){for(const tx of state.signedTransactions){const parsed=parseTransaction(tx.serialized as `0x${string}`);const sender=await recoverTransactionAddress({serializedTransaction:tx.serialized as `0x${string}`});if(keccak256(tx.serialized as `0x${string}`)!==tx.hash || sender.toLowerCase()!==account.address.toLowerCase() || parsed.chainId!==11155111 || (parsed.value??0n)!==0n || ![manifest.contracts.nullPool,manifest.contracts.nullAuthRegistry,manifest.asset.address].some(address=>address.toLowerCase()===parsed.to?.toLowerCase()))throw Error('Refund resume refused: journal transaction mismatch.');if((await rpc.getTransactionReceipt({hash:tx.hash as `0x${string}`})).status!=='success')throw Error('Reconcile the existing transaction before refund.');}}
 else {
 for(const tx of state.signedTransactions){const parsed=parseTransaction(tx.serialized as `0x${string}`);const sender=await recoverTransactionAddress({serializedTransaction:tx.serialized as `0x${string}`});if(keccak256(tx.serialized as `0x${string}`)!==tx.hash || sender.toLowerCase()!==account.address.toLowerCase() || parsed.chainId!==11155111 || (parsed.value??0n)!==0n || !((parsed.to?.toLowerCase()===manifest.contracts.nullAuthRegistry.toLowerCase() && parsed.data===registration)||(parsed.to?.toLowerCase()===manifest.asset.address.toLowerCase()&&parsed.data===approval)))throw Error('Setup resume refused: journal includes a financial or mismatched transaction.');const receipt=await rpc.getTransactionReceipt({hash:tx.hash as `0x${string}`});if(receipt.status!=='success')throw Error('Setup resume requires all previous transactions confirmed.');}
 if(state.checkpoints.some(cp=>cp.phase==='confirmed'))throw Error('A confirmed payment requires recovery, not a setup restart.');
 }
}
async function save(){await mkdir('.artifacts',{recursive:true});const nonce=nodeRandom(12);const cipher=createCipheriv('aes-256-gcm',sealKey,nonce);cipher.setAAD(Buffer.from('NULL Sepolia withdrawal rehearsal v1'));const encrypted=Buffer.concat([cipher.update(stringify(state),'utf8'),cipher.final()]);await writeFile(path+'.tmp',JSON.stringify({version:1,nonce:nonce.toString('hex'),tag:cipher.getAuthTag().toString('hex'),ciphertext:encrypted.toString('hex')}));await rename(path+'.tmp',path);}
async function confirmedGasCost(){let cost=0n;for(const tx of state.signedTransactions){const receipt=await rpc.getTransactionReceipt({hash:tx.hash as `0x${string}`});cost+=receipt.gasUsed*receipt.effectiveGasPrice;}return cost;}
const wallet={...rawWallet,sendTransaction:async(args:any)=>{
  const gas=args.gas??(await rpc.estimateGas({...args,account:account.address}))*120n/100n;
  const latest=await rpc.getBlock();if((latest.baseFeePerGas??0n)>maxFee-100_000_000n)throw Error('Gas price exceeds the rehearsal cap.');
  const quotedFee=(latest.baseFeePerGas??0n)*125n/100n+100_000_000n;
  const transactionFee=quotedFee<maxFee?quotedFee:maxFee;
  if(await confirmedGasCost()+gas*transactionFee>budget)throw Error('Rehearsal gas budget exceeded.');
  const request=await rawWallet.prepareTransactionRequest({...args,account,gas,maxFeePerGas:transactionFee,maxPriorityFeePerGas:100_000_000n});
  const serialized=await rawWallet.signTransaction(request);const hash=keccak256(serialized);
  state.signedTransactions.push({hash,serialized});await save();
  try{return await rpc.sendRawTransaction({serializedTransaction:serialized});}catch{throw Error('Submission uncertain; saved signed transaction must be reconciled before retrying.');}
}};
const server=createServer(async(req,res)=>{const kind=req.url?.match(/^\/circuits\/(shield|create_distribution|claim|withdraw)\.json$/)?.[1];if(!kind){res.writeHead(404).end();return;}try{res.setHeader('content-type','application/json');res.end(await readFile(`apps/web/public/circuits/${kind}.json`));}catch{res.writeHead(500).end();}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const artifactBaseUrl=`http://127.0.0.1:${(server.address() as any).port}`;
const context={chainId:11155111n,poolAddress:manifest.contracts.nullPool};
const signer=(state.signer as `0x${string}`|undefined)??generatePrivateKey();const seed=randomBytes(32);
const policy=(state.policy as any)??{signerPublicKey:toHex(secp256k1.getPublicKey(fromHex(signer),true)),policyMetadata:deriveField(seed,utf8('demo-policy')),registrationBlinder:deriveField(seed,utf8('demo-blinder'))};
const priorKeys=state.recipientKeys as {spend:`0x${string}`;view:`0x${string}`}|undefined;
const keys={spendPrivateKey:fromHex(priorKeys?.spend??generatePrivateKey()),viewPrivateKey:fromHex(priorKeys?.view??generatePrivateKey())};
state.signer=signer;state.policy=policy;state.recipientKeys={spend:toHex(keys.spendPrivateKey),view:toHex(keys.viewPrivateKey)};await save();
const evidence:{steps:unknown[];[key:string]:unknown}=resumeRefund?JSON.parse(await readFile(publicPath,'utf8')):{...plan,startedAt:new Date().toISOString(),steps:[],completed:false};
const initialTokens=BigInt(evidence.testUsdcAtomicAvailable as string);
const live=new NullLiveClient({manifest,rpcUrls:['https://ethereum-sepolia-rpc.publicnode.com'],artifactBaseUrl,confirmations:3,receiptTimeoutMs:180000,maxGas:10_000_000n,persistLocalSecret:async cp=>{state.checkpoints.push(cp);await save();}});
const progress={onProgress:(stage:string)=>console.log(stage),onTransactionSubmitted:async(tx:unknown)=>{evidence.steps.push(tx);await writeFile(publicPath,JSON.stringify(evidence,null,2));}};
try {
 if(!resumeRefund){
 await live.registerPolicy({opening:policy,wallet:wallet as any,persistLocalPolicy:async()=>save(),...progress});
 const shield=await live.prepareShield({amountAtomic:amount,policyCommitment:authPolicyCommitment(policy),acknowledgePublicDeposit:true,...progress});
 const funded=await live.submit(shield,{mode:'wallet',wallet:wallet as any},progress);
 const compiled=await compileDistribution({context,recipients:[{employeeRef:'Rehearsal recipient',amountAtomic:60_000n,stealthMetaAddress:profileFromKeys(keys).stealthMetaAddress}]});
 const distribution=await live.prepareDistribution({compiled,treasuryNotes:[funded.note as OwnedTreasuryNote],authPolicy:policy,authorize:async intent=>toHex(secp256k1.sign(fromHex(intent.digest),fromHex(signer),{prehash:false,lowS:true}).toCompactRawBytes()),...progress});
 const paid=await live.submit(distribution,{mode:'wallet',wallet:wallet as any},progress);
 assert.equal(paid.note.amountAtomic,40_000n);
 const found=await live.discover({keys,...progress});
 state.discovery=found;await save();
 if(found.length!==1)throw Error('Expected exactly one live allocation.');
 const claim=await live.prepareClaim({allocation:found[0],...progress});
 await live.submit(claim,{mode:'wallet',wallet:wallet as any},progress);
 const restoredNotes=await live.recoverPrivateNotes({keys});
 assert.equal(restoredNotes.length,1);assert.equal(restoredNotes[0].amountAtomic,60_000n);
 const withdrawal=await live.prepareWithdrawal({note:restoredNotes[0],recipient:account.address,acknowledgePublicWithdrawal:true,...progress});
 const recipientBefore=await rpc.readContract({address:manifest.asset.address,abi:tokenAbi,functionName:'balanceOf',args:[account.address]});
 await live.submit(withdrawal,{mode:'wallet',wallet:wallet as any},progress);
 assert.equal(await rpc.readContract({address:manifest.asset.address,abi:tokenAbi,functionName:'balanceOf',args:[account.address]}),recipientBefore+60_000n);
 assert.equal((await live.recoverPrivateNotes({keys})).length,0);
 assert.equal((await live.reconcile(withdrawal,undefined)).status,'confirmed');
 await assert.rejects(()=>live.submit(withdrawal,{mode:'wallet',wallet:wallet as any}));
 } else {assert.equal((await live.recoverPrivateNotes({keys})).length,0);assert.equal(await rpc.readContract({address:manifest.asset.address,abi:tokenAbi,functionName:'balanceOf',args:[account.address]}),initialTokens-40_000n);}
 const treasury=(await live.recoverTreasuryNotes(state.checkpoints)).filter(x=>!x.spent&&x.note.amountAtomic>0n);
 assert.equal(treasury.length,1);assert.equal(treasury[0].note.amountAtomic,40_000n);
 const refund=await live.prepareWithdrawal({note:treasury[0].note,recipient:account.address,authPolicy:policy,authorize:async intent=>toHex(secp256k1.sign(fromHex(intent.digest),fromHex(signer),{prehash:false,lowS:true}).toCompactRawBytes()),acknowledgePublicWithdrawal:true,...progress});
 console.log(JSON.stringify({refundGasEstimate:(await rpc.estimateGas({account:account.address,to:manifest.contracts.nullPool,data:refund.transaction.data,value:0n})).toString(),alreadySpentWei:(await confirmedGasCost()).toString(),remainingBudgetWei:(budget-await confirmedGasCost()).toString()}));
 await live.submit(refund,{mode:'wallet',wallet:wallet as any},progress);
 assert.equal(await rpc.readContract({address:manifest.asset.address,abi:tokenAbi,functionName:'balanceOf',args:[account.address]}),initialTokens);
 assert.equal(await rpc.readContract({address:manifest.asset.address,abi:tokenAbi,functionName:'balanceOf',args:[manifest.contracts.nullPool]}),0n);
 let totalGas=0n;
 const receipts=[];
 for(const tx of state.signedTransactions){const receipt=await rpc.getTransactionReceipt({hash:tx.hash as `0x${string}`});assert.equal(receipt.status,'success');totalGas+=receipt.gasUsed*receipt.effectiveGasPrice;receipts.push({hash:tx.hash,blockNumber:Number(receipt.blockNumber),gasUsed:receipt.gasUsed.toString(),effectiveGasPrice:receipt.effectiveGasPrice.toString()});}
 assert.ok(totalGas<=budget);evidence.gasSpentWei=totalGas.toString();evidence.receipts=receipts;
 evidence.checks=['0.1 test USDC deposited','0.06 privately allocated and claimed','original recipient keys recover the claimed note','0.06 withdrawn exactly','spent note excluded from recovery','missing transaction hash reconciled from public history','duplicate withdrawal rejected','0.04 refunded with treasury signature','full 0.1 token balance restored; pool empty'];
 evidence.privacyScope='Functional test using an isolated signer and one funded broadcaster. Public entry and exit are visible; this is not a Privy owner approval or an anonymity claim.';
 const encrypted=JSON.parse(await readFile(path,'utf8'));const decipher=createDecipheriv('aes-256-gcm',sealKey,Buffer.from(encrypted.nonce,'hex'));decipher.setAAD(Buffer.from('NULL Sepolia withdrawal rehearsal v1'));decipher.setAuthTag(Buffer.from(encrypted.tag,'hex'));const restored=parse(Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext,'hex')),decipher.final()]).toString('utf8'));
 if(restored.checkpoints.filter((cp:SecretCheckpoint)=>cp.phase==='confirmed').length<5)throw Error('Recovery verification failed.');
 delete evidence.failure;evidence.completed=true;evidence.recoveryVerified=true;evidence.finishedAt=new Date().toISOString();console.log('PASS deposit -> payment -> claim -> withdrawal -> treasury refund; 0.1 test USDC returned and encrypted journal recovered.');
}catch(error){const known=['Rehearsal gas budget exceeded.','Gas price exceeds the rehearsal cap.','Submission uncertain; saved signed transaction must be reconciled before retrying.'];console.error('Stopped:',error instanceof Error && known.includes(error.message)?error.message:typeof (error as any)?.code==='string' && /^NULL_[A-Z_]+$/.test((error as any).code)?(error as any).code:error instanceof Error?error.name:'unknown');evidence.failure='Rehearsal stopped. Preserve the encrypted journal and reconcile saved transaction hashes before retrying.';process.exitCode=1;console.error(evidence.failure);}
finally{server.closeAllConnections();server.close();await writeFile(publicPath,JSON.stringify(evidence,null,2));sealKey.fill(0);seed.fill(0);keys.spendPrivateKey.fill(0);keys.viewPrivateKey.fill(0);}
