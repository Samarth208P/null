mod pb;

use anyhow::{anyhow, bail, Result};
use ethabi::{Contract, RawLog, Token};
use pb::{Consumption, Distribution, Envelope, Note, Payload, PaymentEvents, PublicPaymentEvent};
use std::{collections::BTreeMap, io::Cursor};
use substreams_ethereum::pb::eth::v2::Block;

fn bytes(fields: &BTreeMap<String, Token>, name: &str) -> Result<Vec<u8>> {
    match fields.get(name) {
        Some(Token::Bytes(value)) | Some(Token::FixedBytes(value)) => Ok(value.clone()),
        Some(Token::Uint(value)) => { let mut out = [0u8; 32]; value.to_big_endian(&mut out); Ok(out.to_vec()) },
        _ => Err(anyhow!("NULL_INDEX_EVENT_INVALID")),
    }
}
fn small(fields: &BTreeMap<String, Token>, name: &str) -> Result<u32> {
    match fields.get(name) {
        Some(Token::Uint(value)) if value.bits() <= 32 => Ok(value.low_u32()),
        _ => Err(anyhow!("NULL_INDEX_EVENT_INVALID")),
    }
}
fn address(text: &str) -> Result<Vec<u8>> {
    let result = hex::decode(text.strip_prefix("0x").unwrap_or(text))?;
    if result.len() != 20 || result.iter().all(|byte| *byte == 0) { bail!("NULL_INDEX_CONFIG_INVALID"); }
    Ok(result)
}

/// Parameters are public chain/emitter context only. No key-based or recipient-specific filter exists.
#[substreams::handlers::map]
pub fn map_private_payments(params: String, block: Block) -> Result<PaymentEvents> {
    let mut config = BTreeMap::new();
    for item in params.split(';') {
        let (key, value) = item.split_once('=').ok_or_else(|| anyhow!("NULL_INDEX_CONFIG_INVALID"))?;
        if !["chain_id", "null_pool", "erc5564"].contains(&key) || config.insert(key, value).is_some() { bail!("NULL_INDEX_CONFIG_INVALID"); }
    }
    let chain_id: u64 = config.get("chain_id").ok_or_else(|| anyhow!("NULL_INDEX_CONFIG_INVALID"))?.parse()?;
    if chain_id == 0 { bail!("NULL_INDEX_CONFIG_INVALID"); }
    let pool = address(config.get("null_pool").ok_or_else(|| anyhow!("NULL_INDEX_CONFIG_INVALID"))?)?;
    let announcer = config.get("erc5564").map(|value| address(value)).transpose()?;
    // ABI is generated from Solidity, shared with the frontend, relayer and subgraph.
    let pool_abi = Contract::load(Cursor::new(include_bytes!("../../../contracts/abi/NullPool.json")))?;
    let standard_abi = Contract::load(Cursor::new(include_bytes!("../../../subgraph/abis/ERC5564Announcer.json")))?;
    let mut events = Vec::new();
    for view in block.logs() {
        let is_null = view.address() == pool.as_slice();
        let is_standard = announcer.as_ref().map_or(false, |value| view.address() == value.as_slice());
        if !is_null && !is_standard { continue; }
        let names: &[&str] = if is_null { &["EnvelopePublished", "DistributionInserted", "AllocationConsumed", "NoteInserted"] } else { &["Announcement"] };
        let abi = if is_null { &pool_abi } else { &standard_abi };
        for name in names {
            let event = abi.event(name)?;
            if view.topics().first().map(|topic| topic.as_slice()) != Some(event.signature().as_bytes()) { continue; }
            if view.topics().iter().any(|topic| topic.len() != 32) { bail!("NULL_INDEX_EVENT_INVALID"); }
            let raw = RawLog { topics: view.topics().iter().map(|topic| ethabi::Hash::from_slice(topic)).collect(), data: view.data().to_vec() };
            let fields: BTreeMap<String, Token> = event.parse_log(raw)?.params.into_iter().map(|param| (param.name, param.value)).collect();
            let payload = match *name {
                "EnvelopePublished" => {
                    let envelope = Envelope { transport_tag: bytes(&fields, "transportTag")?, slot: small(&fields, "slot")?, version: small(&fields, "version")?, scheme_id: { let mut id = vec![0; 32]; id[31] = 1; id }, ephemeral_pub_key: bytes(&fields, "ephemeralPubKey")?, view_tag: bytes(&fields, "viewTag")?, ciphertext: bytes(&fields, "ciphertext")? };
                    if envelope.slot >= 8 || envelope.version != 1 || envelope.ephemeral_pub_key.len() != 33 || envelope.ciphertext.len() != 540 { bail!("NULL_INDEX_EVENT_INVALID"); }
                    Payload::Envelope(envelope)
                },
                "DistributionInserted" => Payload::Distribution(Distribution { commitment: bytes(&fields, "distributionCommitment")?, envelope_root: bytes(&fields, "envelopeRoot")?, transport_tag: bytes(&fields, "transportTag")?, leaf_index: bytes(&fields, "distributionIndex")?, post_distribution_root: bytes(&fields, "postDistributionRoot")?, version: small(&fields, "version")?, slot_count: 8 }),
                "AllocationConsumed" => Payload::Consumption(Consumption { nullifier: bytes(&fields, "claimNullifier")?, output_commitment: bytes(&fields, "noteCommitment")?, note_index: bytes(&fields, "noteIndex")?, post_note_root: bytes(&fields, "postNoteRoot")?, version: small(&fields, "version")? }),
                "NoteInserted" => Payload::Note(Note { commitment: bytes(&fields, "noteCommitment")?, note_index: bytes(&fields, "noteIndex")?, post_note_root: bytes(&fields, "postNoteRoot")?, note_type: small(&fields, "noteType")? }),
                "Announcement" => {
                    let metadata = bytes(&fields, "metadata")?;
                    Payload::Envelope(Envelope { transport_tag: vec![], slot: 0, version: 1, scheme_id: bytes(&fields, "schemeId")?, ephemeral_pub_key: bytes(&fields, "ephemeralPubKey")?, view_tag: metadata.first().map(|byte| vec![*byte]).unwrap_or_default(), ciphertext: metadata })
                },
                _ => continue,
            };
            events.push(PublicPaymentEvent { protocol: if is_null { "NULL" } else { "ERC5564" }.to_string(), chain_id, block_number: block.number, block_hash: block.hash.clone(), transaction_hash: view.receipt.transaction.hash.clone(), log_index: view.block_index(), emitter: view.address().to_vec(), payload: Some(payload) });
        }
    }
    Ok(PaymentEvents { events })
}
