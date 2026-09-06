import { Bytes, dataSource } from '@graphprotocol/graph-ts';
import { Announcement } from '../generated/ERC5564Announcer/ERC5564Announcer';
import { PrivatePaymentEnvelope } from '../generated/schema';

export function handleAnnouncement(event: Announcement): void {
  const entity = new PrivatePaymentEnvelope(event.transaction.hash.toHexString() + '-' + event.logIndex.toString());
  entity.protocol = 'ERC5564'; entity.chainId = dataSource.context().getBigInt('chainId');
  entity.emitter = event.address; entity.blockNumber = event.block.number; entity.blockHash = event.block.hash;
  entity.transactionHash = event.transaction.hash; entity.logIndex = event.logIndex.toI32();
  entity.version = 1; entity.schemeId = event.params.schemeId; entity.ephemeralPubKey = event.params.ephemeralPubKey;
  entity.viewTag = event.params.metadata.length > 0 ? Bytes.fromUint8Array(event.params.metadata.subarray(0, 1)) : Bytes.empty();
  // This is public ERC-5564 metadata, not necessarily authenticated ciphertext. Protocol discriminates it.
  entity.ciphertext = event.params.metadata;
  // Public ERC-5564 caller/address fields are deliberately not reproduced in NULL's transport index.
  entity.save();
}
