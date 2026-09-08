use crate::pb::{PaymentEvents, Payload};
use anyhow::{bail, Result};
use substreams_entity_change::{pb::entity::EntityChanges, tables::Tables};

fn decimal(bytes: &[u8]) -> String { ethabi::Uint::from_big_endian(bytes).to_string() }

pub fn entities(events: PaymentEvents) -> Result<EntityChanges> {
    let mut tables = Tables::new();
    for event in events.events {
        if event.transaction_hash.len() != 32 || event.block_hash.len() != 32 || event.emitter.len() != 20 { bail!("NULL_INDEX_EVENT_INVALID"); }
        let id = format!("0x{}-{}", hex::encode(&event.transaction_hash), event.log_index);
        let entity = match &event.payload {
            Some(Payload::Envelope(_)) => "PrivatePaymentEnvelope",
            Some(Payload::Distribution(_)) => "PrivateDistribution",
            Some(Payload::Consumption(_)) => "PrivateConsumption",
            Some(Payload::Note(_)) => "PrivateNote",
            None => continue,
        };
        let row = tables.create_row(entity, &id);
        row.set("protocol", event.protocol).set("emitter", event.emitter)
            .set("blockHash", event.block_hash).set("transactionHash", event.transaction_hash)
            .set("logIndex", i32::try_from(event.log_index)?);
        row.set_bigint("chainId", &event.chain_id.to_string()).set_bigint("blockNumber", &event.block_number.to_string());
        match event.payload.unwrap() {
            Payload::Envelope(v) => {
                row.set("version", i32::try_from(v.version)?).set_bigint("schemeId", &decimal(&v.scheme_id))
                    .set("ephemeralPubKey", v.ephemeral_pub_key).set("viewTag", v.view_tag).set("ciphertext", v.ciphertext);
                if !v.transport_tag.is_empty() { row.set("transportTag", v.transport_tag).set("slot", i32::try_from(v.slot)?); }
            },
            Payload::Distribution(v) => {
                row.set_bigint("commitment", &decimal(&v.commitment)).set("envelopeRoot", v.envelope_root)
                    .set("transportTag", v.transport_tag).set("slotCount", i32::try_from(v.slot_count)?)
                    .set_bigint("leafIndex", &decimal(&v.leaf_index)).set_bigint("postDistributionRoot", &decimal(&v.post_distribution_root))
                    .set("version", i32::try_from(v.version)?);
            },
            Payload::Consumption(v) => {
                row.set_bigint("nullifier", &decimal(&v.nullifier)).set_bigint("outputCommitment", &decimal(&v.output_commitment))
                    .set_bigint("noteIndex", &decimal(&v.note_index)).set_bigint("postNoteRoot", &decimal(&v.post_note_root))
                    .set("version", i32::try_from(v.version)?);
            },
            Payload::Note(v) => {
                row.set_bigint("commitment", &decimal(&v.commitment)).set_bigint("noteIndex", &decimal(&v.note_index))
                    .set_bigint("postNoteRoot", &decimal(&v.post_note_root)).set("noteType", i32::try_from(v.note_type)?);
            },
        }
    }
    // The table helper uses hash maps. Canonical order makes replay output stable.
    let mut changes = tables.to_entity_changes();
    changes.entity_changes.sort_by(|a,b| (&a.entity,&a.id).cmp(&(&b.entity,&b.id)));
    for row in &mut changes.entity_changes { row.fields.sort_by(|a,b| a.name.cmp(&b.name)); }
    Ok(changes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pb::{Envelope, PublicPaymentEvent};
    fn envelope(protocol: &str, index: u32) -> PublicPaymentEvent {
        PublicPaymentEvent { protocol: protocol.into(), chain_id: 11155111, block_number: 11645265,
            block_hash: vec![1;32], transaction_hash: vec![2;32], log_index:index, emitter:vec![3;20],
            payload:Some(Payload::Envelope(Envelope {transport_tag:if protocol=="NULL" {vec![4;32]} else {vec![]}, slot:0,version:1,scheme_id:vec![1],ephemeral_pub_key:vec![5;33],view_tag:vec![6],ciphertext:vec![7;16]})) }
    }
    #[test]
    fn both_protocols_share_query_fields_and_stable_ids() {
        let input = PaymentEvents {events:vec![envelope("NULL",0),envelope("ERC5564",1)]};
        let output = entities(input.clone()).unwrap();
        assert_eq!(output,entities(input).unwrap());
        assert_eq!(output.entity_changes.len(),2);
        for row in &output.entity_changes {
            assert_eq!(row.entity,"PrivatePaymentEnvelope");
            for field in ["protocol","emitter","blockHash","transactionHash","chainId","blockNumber","logIndex","schemeId","ephemeralPubKey","viewTag","ciphertext"] {
                assert!(row.fields.iter().any(|f|f.name==field));
            }
            assert!(!row.fields.iter().any(|f|["recipient","amount","employeeRef","privateKey"].contains(&f.name.as_str())));
        }
        assert_ne!(output.entity_changes[0].id,output.entity_changes[1].id);
    }
    #[test]
    fn malformed_event_context_fails_closed() {
        let mut event=envelope("NULL",0);event.transaction_hash=vec![1;31];
        assert!(entities(PaymentEvents {events:vec![event]}).is_err());
    }
}
