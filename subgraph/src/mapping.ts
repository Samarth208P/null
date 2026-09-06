import { BigInt, dataSource } from '@graphprotocol/graph-ts';
import { EnvelopePublished, DistributionInserted, AllocationConsumed, NoteInserted } from '../generated/NullPool/NullPool';
import { PrivatePaymentEnvelope, PrivateDistribution, PrivateConsumption, PrivateNote } from '../generated/schema';

export function handleEnvelope(event: EnvelopePublished): void {
  const entity = new PrivatePaymentEnvelope(event.transaction.hash.toHexString() + '-' + event.logIndex.toString());
  entity.protocol = 'NULL'; entity.chainId = dataSource.context().getBigInt('chainId');
  entity.emitter = event.address; entity.blockNumber = event.block.number; entity.blockHash = event.block.hash;
  entity.transactionHash = event.transaction.hash; entity.logIndex = event.logIndex.toI32();
  entity.version = event.params.version; entity.schemeId = BigInt.fromI32(1);
  entity.transportTag = event.params.transportTag; entity.slot = event.params.slot;
  entity.ephemeralPubKey = event.params.ephemeralPubKey; entity.viewTag = event.params.viewTag;
  entity.ciphertext = event.params.ciphertext; entity.save();
}
export function handleDistribution(event: DistributionInserted): void {
  const entity = new PrivateDistribution(event.transaction.hash.toHexString() + '-' + event.logIndex.toString());
  entity.protocol = 'NULL'; entity.chainId = dataSource.context().getBigInt('chainId');
  entity.emitter = event.address; entity.blockNumber = event.block.number; entity.blockHash = event.block.hash;
  entity.transactionHash = event.transaction.hash; entity.logIndex = event.logIndex.toI32();
  entity.commitment = event.params.distributionCommitment; entity.envelopeRoot = event.params.envelopeRoot;
  entity.transportTag = event.params.transportTag; entity.slotCount = 8;
  entity.leafIndex = event.params.distributionIndex; entity.postDistributionRoot = event.params.postDistributionRoot;
  entity.version = event.params.version; entity.save();
}
export function handleConsumption(event: AllocationConsumed): void {
  const entity = new PrivateConsumption(event.transaction.hash.toHexString() + '-' + event.logIndex.toString());
  entity.protocol = 'NULL'; entity.chainId = dataSource.context().getBigInt('chainId');
  entity.emitter = event.address; entity.blockNumber = event.block.number; entity.blockHash = event.block.hash;
  entity.transactionHash = event.transaction.hash; entity.logIndex = event.logIndex.toI32();
  entity.nullifier = event.params.claimNullifier; entity.outputCommitment = event.params.noteCommitment;
  entity.noteIndex = event.params.noteIndex; entity.postNoteRoot = event.params.postNoteRoot;
  entity.version = event.params.version; entity.save();
}
export function handleNote(event: NoteInserted): void {
  const entity = new PrivateNote(event.transaction.hash.toHexString() + '-' + event.logIndex.toString());
  entity.protocol = 'NULL'; entity.chainId = dataSource.context().getBigInt('chainId');
  entity.emitter = event.address; entity.blockNumber = event.block.number; entity.blockHash = event.block.hash;
  entity.transactionHash = event.transaction.hash; entity.logIndex = event.logIndex.toI32();
  entity.commitment = event.params.noteCommitment; entity.noteIndex = event.params.noteIndex;
  entity.postNoteRoot = event.params.postNoteRoot; entity.noteType = event.params.noteType; entity.save();
}
