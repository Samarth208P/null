use null_lib::{Allocation, context, allocation_leaf, merkle_root, distribution_commitment,
    claim_nullifier, private_body, claim_intent};

// [version,chain,pool,globalDistributionRoot,claimNullifier,privateBody,nonce,validUntil]
fn main(
    inputs: pub [Field; 8],
    allocation: Allocation,
    allocation_index: u32,
    allocation_siblings: [Field; 3],
    envelope_root_hi: Field,
    envelope_root_lo: Field,
    transport_tag_hi: Field,
    transport_tag_lo: Field,
    distribution_index: u32,
    distribution_siblings: [Field; 20],
    stealth_signature: [u8; 64],
    owner_nullifier_key: Field,
    note_secret: Field,
) {
    context(inputs[0], inputs[1], inputs[2]);
    inputs[7].assert_max_bit_size::<64>();
    assert(inputs[7] != 0); // NullPool enforces the deadline.
    assert(inputs[6] != 0);
    assert(allocation.is_real);
    assert(allocation.amount > 0);
    let leaf = allocation_leaf(allocation);
    let allocation_root = merkle_root(leaf, allocation_index, allocation_siblings);
    let distribution = distribution_commitment(allocation_root, envelope_root_hi,
        envelope_root_lo, transport_tag_hi, transport_tag_lo);
    assert(merkle_root(distribution, distribution_index, distribution_siblings) == inputs[3]);
    assert(claim_nullifier(distribution, leaf) == inputs[4]);
    assert(inputs[4] != 0);
    assert(private_body(owner_nullifier_key, allocation.amount, note_secret) == inputs[5]);
    // Hidden ECDSA validates the curve point, low-s signature and the entire relay intent.
    assert(std::ecdsa_secp256k1::verify_signature(allocation.public_key_x, allocation.public_key_y,
        stealth_signature, claim_intent(inputs)));
}
