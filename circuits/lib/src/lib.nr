pub mod domains;
use poseidon::poseidon::bn254;

pub struct TreasuryInput {
    pub is_real: bool,
    pub owner_nullifier_key: Field,
    pub amount: u64,
    pub note_secret: Field,
    pub leaf_index: u32,
    pub siblings: [Field; 20],
}

pub struct Allocation {
    pub public_key_x: [u8; 32],
    pub public_key_y: [u8; 32],
    pub amount: u64,
    pub leaf_salt: Field,
    pub is_real: bool,
}

pub fn context(version: Field, chain_id: Field, pool: Field) {
    assert(version == 1);
    chain_id.assert_max_bit_size::<64>();
    pool.assert_max_bit_size::<160>();
    assert(chain_id != 0);
    assert(pool != 0);
}

pub fn public_key_commitment(x: [u8; 32], y: [u8; 32]) -> Field {
    // Every byte is range constrained by u8. No coordinate is reduced into Field.
    let mut limbs = [0; 4];
    for i in 0..16 {
        limbs[0] = limbs[0] * 256 + x[i] as Field;
        limbs[1] = limbs[1] * 256 + x[i + 16] as Field;
        limbs[2] = limbs[2] * 256 + y[i] as Field;
        limbs[3] = limbs[3] * 256 + y[i + 16] as Field;
    }
    bn254::hash_5([domains::PK, limbs[0], limbs[1], limbs[2], limbs[3]])
}

pub fn treasury_body(owner_key: Field, policy: Field, amount: u64, secret: Field) -> Field {
    assert(owner_key != 0);
    assert(secret != 0);
    assert(policy != 0);
    let owner_hash = bn254::hash_2([domains::NOTE_OWNER, owner_key]);
    bn254::hash_5([domains::TREASURY_NOTE, owner_hash, policy, amount as Field, secret])
}

pub fn private_body(owner_key: Field, amount: u64, secret: Field) -> Field {
    assert(owner_key != 0);
    assert(secret != 0);
    let owner_hash = bn254::hash_2([domains::NOTE_OWNER, owner_key]);
    bn254::hash_4([domains::PRIVATE_NOTE, owner_hash, amount as Field, secret])
}

pub fn finalize_note(body: Field, index: u32) -> Field {
    bn254::hash_3([domains::FINAL_NOTE, body, index as Field])
}

pub fn note_nullifier(commitment: Field, owner_key: Field) -> Field {
    bn254::hash_3([domains::NOTE_NULLIFIER, commitment, owner_key])
}

pub fn phantom_nullifier(owner_key: Field, nonce: Field, slot: Field, policy: Field) -> Field {
    assert(owner_key != 0);
    bn254::hash_5([domains::PHANTOM_NULLIFIER, owner_key, nonce, slot, policy])
}

pub fn merkle_root<let DEPTH: u32>(leaf: Field, index: u32, siblings: [Field; DEPTH]) -> Field {
    assert((index as Field).lt((1 << DEPTH) as Field));
    let mut result = leaf;
    for level in 0..DEPTH {
        let right = ((index >> level) & 1) == 1;
        let left_value = if right { siblings[level] } else { result };
        let right_value = if right { result } else { siblings[level] };
        result = bn254::hash_3([domains::MERKLE, left_value, right_value]);
    }
    result
}

pub fn allocation_leaf(allocation: Allocation) -> Field {
    if allocation.is_real { assert(allocation.amount > 0); }
    else { assert(allocation.amount == 0); }
    assert(allocation.leaf_salt != 0);
    let key = public_key_commitment(allocation.public_key_x, allocation.public_key_y);
    bn254::hash_5([domains::ALLOCATION, key, allocation.amount as Field,
        allocation.leaf_salt, allocation.is_real as Field])
}

pub fn allocation_root(leaves: [Field; 8]) -> Field {
    let mut current = leaves;
    for i in 0..4 { current[i] = bn254::hash_3([domains::MERKLE, leaves[i * 2], leaves[i * 2 + 1]]); }
    for i in 0..2 { current[i] = bn254::hash_3([domains::MERKLE, current[i * 2], current[i * 2 + 1]]); }
    bn254::hash_3([domains::MERKLE, current[0], current[1]])
}

pub fn distribution_commitment(allocation: Field, envelope_hi: Field, envelope_lo: Field,
    transport_hi: Field, transport_lo: Field) -> Field
{
    envelope_hi.assert_max_bit_size::<128>();
    envelope_lo.assert_max_bit_size::<128>();
    transport_hi.assert_max_bit_size::<128>();
    transport_lo.assert_max_bit_size::<128>();
    // Version 1 has no allocation expiry/reclaim path.
    bn254::hash_8([domains::DISTRIBUTION, 1, allocation, envelope_hi, envelope_lo, 0, transport_hi, transport_lo])
}

pub fn auth_policy(x: [u8; 32], y: [u8; 32], metadata: Field, blinder: Field) -> Field {
    assert(blinder != 0);
    bn254::hash_4([domains::AUTH_POLICY, public_key_commitment(x, y), metadata, blinder])
}

pub fn distribution_intent(inputs: [Field; 15]) -> [u8; 32] {
    let mut message = [0; 16];
    message[0] = domains::AUTH_INTENT;
    for i in 0..15 { message[i + 1] = inputs[i]; }
    bn254::hash_16(message).to_be_bytes::<32>()
}

pub fn claim_intent(inputs: [Field; 8]) -> [u8; 32] {
    let mut message = [0; 9];
    message[0] = domains::CLAIM_INTENT;
    for i in 0..8 { message[i + 1] = inputs[i]; }
    bn254::hash_9(message).to_be_bytes::<32>()
}

pub fn claim_nullifier(distribution: Field, allocation: Field) -> Field {
    bn254::hash_3([domains::CLAIM_NULLIFIER, distribution, allocation])
}
