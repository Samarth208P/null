//! Prost types matching proto/private_payments.proto; no runtime code generation required.
#[derive(Clone, PartialEq, prost::Message)]
pub struct PaymentEvents {
    #[prost(message, repeated, tag = "1")]
    pub events: Vec<PublicPaymentEvent>,
}
#[derive(Clone, PartialEq, prost::Message)]
pub struct PublicPaymentEvent {
    #[prost(string, tag = "1")] pub protocol: String,
    #[prost(uint64, tag = "2")] pub chain_id: u64,
    #[prost(uint64, tag = "3")] pub block_number: u64,
    #[prost(bytes = "vec", tag = "4")] pub block_hash: Vec<u8>,
    #[prost(bytes = "vec", tag = "5")] pub transaction_hash: Vec<u8>,
    #[prost(uint32, tag = "6")] pub log_index: u32,
    #[prost(bytes = "vec", tag = "7")] pub emitter: Vec<u8>,
    #[prost(oneof = "Payload", tags = "10, 11, 12, 13")] pub payload: Option<Payload>,
}
#[derive(Clone, PartialEq, prost::Oneof)]
pub enum Payload {
    #[prost(message, tag = "10")] Envelope(Envelope),
    #[prost(message, tag = "11")] Distribution(Distribution),
    #[prost(message, tag = "12")] Consumption(Consumption),
    #[prost(message, tag = "13")] Note(Note),
}
#[derive(Clone, PartialEq, prost::Message)]
pub struct Envelope {
    #[prost(bytes = "vec", tag = "1")] pub transport_tag: Vec<u8>,
    #[prost(uint32, tag = "2")] pub slot: u32,
    #[prost(uint32, tag = "3")] pub version: u32,
    #[prost(bytes = "vec", tag = "4")] pub scheme_id: Vec<u8>,
    #[prost(bytes = "vec", tag = "5")] pub ephemeral_pub_key: Vec<u8>,
    #[prost(bytes = "vec", tag = "6")] pub view_tag: Vec<u8>,
    #[prost(bytes = "vec", tag = "7")] pub ciphertext: Vec<u8>,
}
#[derive(Clone, PartialEq, prost::Message)]
pub struct Distribution {
    #[prost(bytes = "vec", tag = "1")] pub commitment: Vec<u8>,
    #[prost(bytes = "vec", tag = "2")] pub envelope_root: Vec<u8>,
    #[prost(bytes = "vec", tag = "3")] pub transport_tag: Vec<u8>,
    #[prost(bytes = "vec", tag = "4")] pub leaf_index: Vec<u8>,
    #[prost(bytes = "vec", tag = "5")] pub post_distribution_root: Vec<u8>,
    #[prost(uint32, tag = "6")] pub version: u32,
    #[prost(uint32, tag = "7")] pub slot_count: u32,
}
#[derive(Clone, PartialEq, prost::Message)]
pub struct Consumption {
    #[prost(bytes = "vec", tag = "1")] pub nullifier: Vec<u8>,
    #[prost(bytes = "vec", tag = "2")] pub output_commitment: Vec<u8>,
    #[prost(bytes = "vec", tag = "3")] pub note_index: Vec<u8>,
    #[prost(bytes = "vec", tag = "4")] pub post_note_root: Vec<u8>,
    #[prost(uint32, tag = "5")] pub version: u32,
}
#[derive(Clone, PartialEq, prost::Message)]
pub struct Note {
    #[prost(bytes = "vec", tag = "1")] pub commitment: Vec<u8>,
    #[prost(bytes = "vec", tag = "2")] pub note_index: Vec<u8>,
    #[prost(bytes = "vec", tag = "3")] pub post_note_root: Vec<u8>,
    #[prost(uint32, tag = "4")] pub note_type: u32,
}
