use null_lib::{context, private_body, finalize_note, note_nullifier, merkle_root};

// [version, chain, pool, noteRoot, authRoot, nullifier, recipient, amount,
//  changeBody, nonce, validUntil]. Original amount, note and owner stay private.
// Private recipient notes only: treasury policy notes cannot satisfy this circuit.
fn main(
    inputs: pub [Field; 11],
    owner_nullifier_key: Field,
    note_secret: Field,
    note_amount: u64,
    leaf_index: u32,
    note_siblings: [Field; 20],
    change_owner_nullifier_key: Field,
    change_note_secret: Field,
) {
    context(inputs[0], inputs[1], inputs[2]);
    inputs[6].assert_max_bit_size::<160>();
    assert(inputs[6] != 0);
    assert(inputs[6] != inputs[2]);
    inputs[7].assert_max_bit_size::<64>();
    let amount = inputs[7] as u64;
    assert(amount > 0);
    assert(amount < note_amount);
    assert(inputs[9] != 0);
    inputs[10].assert_max_bit_size::<64>();
    assert(inputs[10] != 0);
    let body = private_body(owner_nullifier_key, note_amount, note_secret);
    let commitment = finalize_note(body, leaf_index);
    assert(merkle_root(commitment, leaf_index, note_siblings) == inputs[3]);
    assert(note_nullifier(commitment, owner_nullifier_key) == inputs[5]);
    assert(inputs[5] != 0);
    // Range-checked u64 subtraction proves exact conservation without field wrap.
    let change = note_amount - amount;
    assert(private_body(change_owner_nullifier_key, change, change_note_secret) == inputs[8]);
}
