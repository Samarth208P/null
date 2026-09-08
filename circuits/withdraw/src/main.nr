use null_lib::{context, treasury_body, private_body, finalize_note, note_nullifier, merkle_root, auth_policy};
use poseidon::poseidon::bn254;

// Full-note exit: [version,chain,pool,noteRoot,authRoot,nullifier,recipient,amount,nonce,validUntil].
// Neither the spent commitment, note index, owner key nor treasury/private type is public.
fn main(
    inputs: pub [Field; 10],
    is_treasury: bool,
    owner_nullifier_key: Field,
    note_secret: Field,
    leaf_index: u32,
    note_siblings: [Field; 20],
    signer_public_key_x: [u8; 32],
    signer_public_key_y: [u8; 32],
    policy_metadata: Field,
    registration_blinder: Field,
    policy_index: u32,
    policy_siblings: [Field; 20],
    signer_signature: [u8; 64],
) {
    context(inputs[0], inputs[1], inputs[2]);
    inputs[6].assert_max_bit_size::<160>();
    assert(inputs[6] != 0);
    assert(inputs[6] != inputs[2]);
    inputs[7].assert_max_bit_size::<64>();
    assert(inputs[7] != 0);
    assert(inputs[8] != 0);
    inputs[9].assert_max_bit_size::<64>();
    assert(inputs[9] != 0);
    let amount = inputs[7] as u64;
    let body = if is_treasury {
        let policy = auth_policy(signer_public_key_x, signer_public_key_y, policy_metadata, registration_blinder);
        assert(merkle_root(policy, policy_index, policy_siblings) == inputs[4]);
        // Domain-separated approval binds ALL ten public fields, including destination and amount.
        let mut intent = [0; 11];
        intent[0] = 130525281846869432450899341789745535586475128559513537600521579419799020402;
        for i in 0..10 { intent[i + 1] = inputs[i]; }
        assert(std::ecdsa_secp256k1::verify_signature(signer_public_key_x, signer_public_key_y,
            signer_signature, bn254::hash_11(intent).to_be_bytes::<32>()));
        treasury_body(owner_nullifier_key, policy, amount, note_secret)
    } else {
        private_body(owner_nullifier_key, amount, note_secret)
    };
    let commitment = finalize_note(body, leaf_index);
    assert(merkle_root(commitment, leaf_index, note_siblings) == inputs[3]);
    assert(note_nullifier(commitment, owner_nullifier_key) == inputs[5]);
    assert(inputs[5] != 0);
}
