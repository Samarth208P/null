use null_lib::{TreasuryInput, Allocation, context, treasury_body, finalize_note,
    note_nullifier, phantom_nullifier, merkle_root, allocation_leaf, allocation_root,
    distribution_commitment, auth_policy, distribution_intent};

// [version,chain,pool,noteRoot,authRoot,nf0,nf1,distribution,envelopeHi,envelopeLo,
//  changeBody,transportHi,transportLo,nonce,validUntil]
fn main(
    inputs: pub [Field; 15],
    treasury_inputs: [TreasuryInput; 2],
    allocations: [Allocation; 8],
    signer_public_key_x: [u8; 32],
    signer_public_key_y: [u8; 32],
    signer_signature: [u8; 64],
    policy_metadata: Field,
    registration_blinder: Field,
    policy_index: u32,
    policy_siblings: [Field; 20],
    change_owner_nullifier_key: Field,
    change_amount: u64,
    change_note_secret: Field,
) {
    context(inputs[0], inputs[1], inputs[2]);
    inputs[14].assert_max_bit_size::<64>();
    assert(inputs[14] != 0); // NullPool checks block.timestamp <= validUntil.
    assert(inputs[13] != 0);
    assert(inputs[5] != 0);
    assert(inputs[6] != 0);
    assert(inputs[5] != inputs[6]);
    let policy = auth_policy(signer_public_key_x, signer_public_key_y, policy_metadata, registration_blinder);
    assert(merkle_root(policy, policy_index, policy_siblings) == inputs[4]);
    assert(treasury_inputs[0].is_real);
    let mut total_in: Field = 0;
    for slot in 0..2 {
        let note = treasury_inputs[slot];
        if note.is_real {
            assert(note.amount > 0);
            let body = treasury_body(note.owner_nullifier_key, policy, note.amount, note.note_secret);
            let commitment = finalize_note(body, note.leaf_index);
            assert(merkle_root(commitment, note.leaf_index, note.siblings) == inputs[3]);
            assert(note_nullifier(commitment, note.owner_nullifier_key) == inputs[5 + slot]);
            total_in += note.amount as Field;
        } else {
            assert(note.amount == 0);
            assert(note.note_secret == 0);
            assert(note.leaf_index == 0);
            for i in 0..20 { assert(note.siblings[i] == 0); }
            assert(phantom_nullifier(note.owner_nullifier_key, inputs[13], slot as Field, policy) == inputs[5 + slot]);
        }
    }
    let mut leaves = [0; 8];
    let mut allocated: Field = 0;
    for slot in 0..8 {
        leaves[slot] = allocation_leaf(allocations[slot]);
        allocated += allocations[slot].amount as Field;
    }
    assert(allocated != 0);
    // All terms are uint64, with at most 8 outputs; these integer sums cannot wrap BN254.
    assert(total_in == allocated + change_amount as Field);
    assert(treasury_body(change_owner_nullifier_key, policy, change_amount, change_note_secret) == inputs[10]);
    assert(distribution_commitment(allocation_root(leaves), inputs[8], inputs[9], inputs[11], inputs[12]) == inputs[7]);
    assert(std::ecdsa_secp256k1::verify_signature(signer_public_key_x, signer_public_key_y,
        signer_signature, distribution_intent(inputs)));
}

