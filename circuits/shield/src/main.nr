use null_lib::{context, treasury_body};

// Public order: version, chain, pool, amount, treasury body, auth policy.
fn main(inputs: pub [Field; 6], owner_nullifier_key: Field, note_secret: Field) {
    context(inputs[0], inputs[1], inputs[2]);
    inputs[3].assert_max_bit_size::<64>();
    let amount = inputs[3] as u64;
    assert(amount > 0);
    assert(treasury_body(owner_nullifier_key, inputs[5], amount, note_secret) == inputs[4]);
    // NullPool enforces policy registration and exactly amount tokens received.
}

